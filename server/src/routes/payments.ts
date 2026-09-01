import { Router, Request, Response } from "express";
import {
  createRazorpayOrder,
  verifyAndCapturePayment,
  PaymentError,
} from "../services/payment";

const router = Router();

// POST /api/payments/create — create a Razorpay order for an existing order
router.post("/create", async (req: Request, res: Response) => {
  try {
    const { orderId } = req.body as { orderId: string };

    if (!orderId || typeof orderId !== "string") {
      res.status(400).json({ error: "Order ID is required" });
      return;
    }

    const result = await createRazorpayOrder(orderId);
    res.json(result);
  } catch (error) {
    if (error instanceof PaymentError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    console.error("Failed to create payment:", error);
    res.status(500).json({ error: "Failed to create payment" });
  }
});

// POST /api/payments/verify — verify Razorpay payment signature
router.post("/verify", async (req: Request, res: Response) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } =
      req.body as {
        razorpayOrderId: string;
        razorpayPaymentId: string;
        razorpaySignature: string;
      };

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      res.status(400).json({
        error:
          "razorpayOrderId, razorpayPaymentId, and razorpaySignature are required",
      });
      return;
    }

    const result = await verifyAndCapturePayment(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );

    res.json(result);
  } catch (error) {
    if (error instanceof PaymentError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    console.error("Failed to verify payment:", error);
    res.status(500).json({ error: "Failed to verify payment" });
  }
});

export default router;
