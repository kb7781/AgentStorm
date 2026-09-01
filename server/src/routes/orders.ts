import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { logEvent } from "../services/events";
import { failOrCancelOrderAndRestoreInventory } from "../services/order";

const router = Router();

interface OrderItemInput {
  productId: string;
  quantity: number;
}

interface CreateOrderBody {
  email: string;
  items: OrderItemInput[];
}

// POST /api/orders — create an order
router.post("/", async (req: Request, res: Response) => {
  try {
    const { email, items } = req.body as CreateOrderBody;

    // Validate input
    if (!email || typeof email !== "string" || !email.includes("@")) {
      res.status(400).json({ error: "Valid email is required" });
      return;
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "At least one item is required" });
      return;
    }

    // Validate each item
    for (const item of items) {
      if (!item.productId || typeof item.productId !== "string") {
        res.status(400).json({ error: "Invalid product ID" });
        return;
      }
      if (
        !item.quantity ||
        typeof item.quantity !== "number" ||
        item.quantity < 1 ||
        !Number.isInteger(item.quantity)
      ) {
        res
          .status(400)
          .json({ error: `Invalid quantity for product ${item.productId}` });
        return;
      }
    }

    // Deduplicate items by productId (sum quantities)
    const itemMap = new Map<string, number>();
    for (const item of items) {
      const existing = itemMap.get(item.productId) || 0;
      itemMap.set(item.productId, existing + item.quantity);
    }

    // Fetch all products from DB — server is source of truth
    const productIds = Array.from(itemMap.keys());
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    if (products.length !== productIds.length) {
      const foundIds = new Set(products.map((p) => p.id));
      const missing = productIds.filter((id) => !foundIds.has(id));
      res
        .status(404)
        .json({ error: `Products not found: ${missing.join(", ")}` });
      return;
    }

    // Validate stock for each product
    for (const product of products) {
      const requestedQty = itemMap.get(product.id)!;
      if (requestedQty > product.stock) {
        res.status(400).json({
          error: `Insufficient stock for "${product.name}". Available: ${product.stock}, requested: ${requestedQty}`,
        });
        return;
      }
    }

    // Calculate totals server-side
    const orderItems = products.map((product) => {
      const quantity = itemMap.get(product.id)!;
      const unitPrice = product.price;
      const subtotal = new Decimal(unitPrice).mul(quantity);
      return {
        productId: product.id,
        quantity,
        unitPrice,
        subtotal,
      };
    });

    const totalAmount = orderItems.reduce(
      (sum, item) => sum.add(item.subtotal),
      new Decimal(0)
    );

    // Create order, order items, and decrement stock in a single transaction
    const order = await prisma.$transaction(async (tx) => {
      // Create the order
      const newOrder = await tx.order.create({
        data: {
          email,
          totalAmount,
          status: "PENDING",
          items: {
            create: orderItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal: item.subtotal,
            })),
          },
        },
        include: {
          items: {
            include: {
              product: {
                select: { id: true, name: true, category: true },
              },
            },
          },
        },
      });

      // Decrement stock for each product
      for (const item of orderItems) {
        const updated = await tx.product.updateMany({
          where: {
            id: item.productId,
            stock: { gte: item.quantity }, // Prevent negative stock
          },
          data: {
            stock: { decrement: item.quantity },
          },
        });

        if (updated.count === 0) {
          // Stock changed between validation and transaction
          throw new Error(
            `Stock no longer available for product ${item.productId}`
          );
        }
      }

      return newOrder;
    });

    res.status(201).json({ order });
    
    // Log events asynchronously
    logEvent("ORDER_CREATED", order.id, { email: order.email, totalAmount: order.totalAmount });
    logEvent("STOCK_RESERVED", order.id, { items: orderItems.map(i => ({ productId: i.productId, quantity: i.quantity })) });

  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create order";
    console.error("Failed to create order:", error);

    // If it's a stock error from our transaction, return 400
    if (message.includes("Stock no longer available")) {
      res.status(400).json({ error: message });
      return;
    }

    res.status(500).json({ error: "Failed to create order" });
  }
});

// GET /api/orders/:id — get order with items and payment
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    if (!id || typeof id !== "string" || id.length < 10 || id.length > 40) {
      res.status(400).json({ error: "Invalid order ID format" });
      return;
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, category: true },
            },
          },
        },
        payment: {
          select: {
            id: true,
            status: true,
            razorpayPaymentId: true,
            amount: true,
            createdAt: true,
          },
        },
      },
    });

    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    res.json({ order });
  } catch (error) {
    console.error("Failed to fetch order:", error);
    res.status(500).json({ error: "Failed to fetch order" });
  }
});

// POST /api/orders/:id/cancel — cancel an order and restore stock
router.post("/:id/cancel", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    if (order.status !== "PENDING") {
      res.status(400).json({ error: `Cannot cancel order in status ${order.status}` });
      return;
    }

    const updatedOrder = await failOrCancelOrderAndRestoreInventory(id, "CANCELLED");

    logEvent("ORDER_CANCELLED", id);
    logEvent("STOCK_RESTORED", id);

    res.json({ order: updatedOrder });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to cancel order";
    console.error("Failed to cancel order:", error);
    if (message.includes("Inventory already restored")) {
      res.status(400).json({ error: message });
      return;
    }
    res.status(500).json({ error: "Failed to cancel order" });
  }
});

export default router;
