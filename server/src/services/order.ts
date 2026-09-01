import prisma from "../lib/prisma";
import { logEvent } from "./events";

/**
 * Restores inventory for an order if it hasn't been restored yet.
 * Sets the order status to the given target status (CANCELLED or FAILED).
 * Uses a transaction to prevent double restoration.
 */
export async function failOrCancelOrderAndRestoreInventory(
  orderId: string,
  targetStatus: "FAILED" | "CANCELLED"
) {
  return await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      throw new Error("Order not found");
    }

    if (order.inventoryRestored) {
      throw new Error("Inventory already restored for this order");
    }

    // Update order status and set inventoryRestored to true
    const updatedOrder = await tx.order.update({
      where: { id: orderId },
      data: {
        status: targetStatus,
        inventoryRestored: true,
      },
    });

    // Restore stock for each item
    for (const item of order.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: {
          stock: { increment: item.quantity },
        },
      });
    }

    return updatedOrder;
  });
}
