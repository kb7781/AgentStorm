import Razorpay from "razorpay";
import crypto from "crypto";
import prisma from "../lib/prisma";
import { logEvent } from "./events";
import { failOrCancelOrderAndRestoreInventory } from "./order";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "",
});

/**
 * Create a Razorpay order for an existing Order.
 * - Fetches order from DB
 * - Creates Razorpay order via API
 * - Stores razorpayOrderId on Order
 * - Creates Payment record with PENDING status
 */
export async function createRazorpayOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payment: true },
  });

  if (!order) {
    throw new PaymentError("Order not found", 404);
  }

  if (order.status === "PAID") {
    throw new PaymentError("Order is already paid", 400);
  }

  // If a Razorpay order already exists for this order, return it
  // (idempotency for create)
  if (order.razorpayOrderId && order.payment) {
    return {
      razorpayOrderId: order.razorpayOrderId,
      amount: Number(order.totalAmount) * 100, // paise
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID || "",
    };
  }

  // Amount in paise (Razorpay expects smallest currency unit)
  const amountInPaise = Math.round(Number(order.totalAmount) * 100);

  const razorpayOrder = await razorpay.orders.create({
    amount: amountInPaise,
    currency: "INR",
    receipt: orderId,
    notes: {
      orderId: orderId,
      email: order.email,
    },
  });

  // Update order with Razorpay order ID and create payment record
  await prisma.$transaction([
    prisma.order.update({
      where: { id: orderId },
      data: { razorpayOrderId: razorpayOrder.id },
    }),
    prisma.payment.create({
      data: {
        orderId: orderId,
        razorpayOrderId: razorpayOrder.id,
        amount: order.totalAmount,
        status: "PENDING",
      },
    }),
  ]);

  return {
    razorpayOrderId: razorpayOrder.id,
    amount: amountInPaise,
    currency: "INR",
    keyId: process.env.RAZORPAY_KEY_ID || "",
  };
}

/**
 * Verify Razorpay payment signature and mark order as PAID.
 * - Verifies HMAC SHA256 signature
 * - Updates Payment to CAPTURED
 * - Updates Order to PAID
 * - Handles idempotency (already captured → returns success)
 */
export async function verifyAndCapturePayment(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string
) {
  // Check for duplicate: if this payment ID already captured, return success
  const existingPayment = await prisma.payment.findUnique({
    where: { razorpayPaymentId },
    include: { order: true },
  });

  if (existingPayment && existingPayment.status === "CAPTURED") {
    return {
      verified: true,
      orderId: existingPayment.orderId,
      status: existingPayment.order.status,
      message: "Payment already verified",
    };
  }

  // Find the payment by Razorpay order ID
  const payment = await prisma.payment.findFirst({
    where: { razorpayOrderId },
    include: { order: true },
  });

  if (!payment) {
    throw new PaymentError("Payment record not found", 404);
  }

  if (payment.status === "CAPTURED") {
    return {
      verified: true,
      orderId: payment.orderId,
      status: payment.order.status,
      message: "Payment already verified",
    };
  }

  // Verify signature: HMAC SHA256 of "razorpayOrderId|razorpayPaymentId"
  const secret = process.env.RAZORPAY_KEY_SECRET || "";
  const body = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");

  if (expectedSignature !== razorpaySignature) {
    // Mark payment as failed
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        razorpayPaymentId,
        razorpaySignature,
        status: "FAILED",
      },
    });

    try {
      await failOrCancelOrderAndRestoreInventory(payment.orderId, "FAILED");
      logEvent("STOCK_RESTORED", payment.orderId);
    } catch (e) {
      console.error("Failed to restore inventory on payment failure:", e);
    }

    logEvent("PAYMENT_FAILED", payment.orderId, { reason: "Invalid signature" });

    throw new PaymentError("Invalid payment signature", 400);
  }

  // Signature valid — mark as captured and order as paid
  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: {
        razorpayPaymentId,
        razorpaySignature,
        status: "CAPTURED",
      },
    }),
    prisma.order.update({
      where: { id: payment.orderId },
      data: { status: "PAID" },
    }),
  ]);

  logEvent("PAYMENT_SUCCESS", payment.orderId, { razorpayPaymentId });
  logEvent("ORDER_PAID", payment.orderId);

  return {
    verified: true,
    orderId: payment.orderId,
    status: "PAID",
    message: "Payment verified successfully",
  };
}

/**
 * Custom error class for payment-related errors with HTTP status.
 */
export class PaymentError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "PaymentError";
    this.status = status;
  }
}
