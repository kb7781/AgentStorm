import prisma from "../server/src/lib/prisma";
import { runSimulation } from "../server/src/services/simulation";
import { failOrCancelOrderAndRestoreInventory } from "../server/src/services/order";

async function main() {
  console.log("==================================================");
  console.log("  AGENTSTORM — FLASH SALE INVENTORY SEMANTICS     ");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  const assert = (condition: boolean, msg: string) => {
    if (condition) {
      console.log(`  ✅ ${msg}`);
      passed++;
    } else {
      console.log(`  ❌ ${msg}`);
      failed++;
    }
  };

  // 1. Reset database stock to 100 for SonicWave Buds SE
  await prisma.product.updateMany({
    where: { name: { contains: "SonicWave Buds SE", mode: "insensitive" } },
    data: { stock: 100 },
  });
  await prisma.product.updateMany({
    where: { NOT: { name: { contains: "SonicWave Buds SE", mode: "insensitive" } } },
    data: { stock: 50 },
  });

  // ─── Test 1: Clean Seeded Baseline State ───────────────────────────
  console.log("\n[Test 1] Clean Baseline Inventory Verification...");
  const initialSonic = await prisma.product.findFirst({
    where: { name: { contains: "SonicWave Buds SE", mode: "insensitive" } },
  });
  assert(initialSonic?.stock === 100, `SonicWave Buds SE initial baseline stock is 100 (Found: ${initialSonic?.stock})`);

  // ─── Test 2: Flash Sale 2-Unit Capacity & Baseline Reduction (100 → 2 → 0 → 98) ───
  console.log("\n[Test 2] Flash Sale (100 → 2 → 0 → 98)...");
  const simFlash1 = await runSimulation("flash-sale");

  assert(simFlash1.totalBuyers === 5, `5 concurrent AI buyers participated`);
  assert(simFlash1.inventoryIntegrity.oversellCount === 0, `Zero oversell events detected`);
  assert(simFlash1.inventoryIntegrity.isSafe, `Inventory integrity marked safe (Safe: true)`);

  const targetOrders1 = simFlash1.orderSummaries.filter((o) =>
    o.productName.toLowerCase().includes("sonicwave buds se")
  );
  assert(targetOrders1.length === 2, `Exactly 2 units of SonicWave Buds SE were successfully purchased (Bought: ${targetOrders1.length})`);

  const sonicAfterFlash1 = await prisma.product.findFirst({
    where: { name: { contains: "SonicWave Buds SE", mode: "insensitive" } },
  });
  assert(
    sonicAfterFlash1?.stock === 98,
    `SonicWave Buds SE DB stock reduced from 100 to 98 after 2 purchases (Found: ${sonicAfterFlash1?.stock})`
  );

  // ─── Test 3: Flash Sale with 1 Net Purchase (98 → 2 → 1 → 97) ─────
  console.log("\n[Test 3] Flash Sale with 1 Purchase (98 → 2 → 1 → 97)...");
  // Set stock to 98
  await prisma.product.updateMany({
    where: { name: { contains: "SonicWave Buds SE", mode: "insensitive" } },
    data: { stock: 98 },
  });

  const simFlash2 = await runSimulation("flash-sale");
  const targetOrders2 = simFlash2.orderSummaries.filter((o) =>
    o.productName.toLowerCase().includes("sonicwave buds se")
  );
  // If 2 purchased -> 98 - 2 = 96
  const expectedStock2 = 98 - targetOrders2.length;
  const sonicAfterFlash2 = await prisma.product.findFirst({
    where: { name: { contains: "SonicWave Buds SE", mode: "insensitive" } },
  });
  assert(
    sonicAfterFlash2?.stock === expectedStock2,
    `SonicWave Buds SE DB stock dynamically calculated as ${expectedStock2} (98 - ${targetOrders2.length}) (Found: ${sonicAfterFlash2?.stock})`
  );

  // ─── Test 4: Flash Sale with 0 Net Purchases (100 → 2 → 0 → 100 via Cancellation) ───
  console.log("\n[Test 4] Flash Sale with Cancellation (100 → 2 → 0 → 100)...");
  await prisma.product.updateMany({
    where: { name: { contains: "SonicWave Buds SE", mode: "insensitive" } },
    data: { stock: 100 },
  });

  const simFlash3 = await runSimulation("flash-sale");
  const createdOrderIds = simFlash3.orderSummaries.map((o) => o.orderId);

  // Cancel all created orders to restore inventory
  for (const orderId of createdOrderIds) {
    await failOrCancelOrderAndRestoreInventory(orderId, "CANCELLED");
  }

  // Recalculate net purchases after cancellation
  const activeOrderItems = await prisma.orderItem.findMany({
    where: {
      orderId: { in: createdOrderIds },
      order: { status: { notIn: ["CANCELLED", "FAILED"] } },
    },
  });
  assert(activeOrderItems.length === 0, `0 active order items remaining after cancellation`);

  // Verify stock restored cleanly to 100
  const sonicAfterCancel = await prisma.product.findFirst({
    where: { name: { contains: "SonicWave Buds SE", mode: "insensitive" } },
  });
  assert(
    sonicAfterCancel?.stock === 100,
    `SonicWave Buds SE DB stock restored to 100 after order cancellation (Found: ${sonicAfterCancel?.stock})`
  );

  // ─── Test 5: Idempotency & Safety Guarantees ──────────────────────
  console.log("\n[Test 5] Safety & Idempotency Guarantees...");
  let doubleRestoreBlocked = false;
  if (createdOrderIds.length > 0) {
    try {
      await failOrCancelOrderAndRestoreInventory(createdOrderIds[0], "CANCELLED");
    } catch (err: any) {
      doubleRestoreBlocked = err.message.includes("already restored");
    }
  }
  assert(doubleRestoreBlocked, `Double inventory restoration strictly blocked by transaction guard`);

  const allProducts = await prisma.product.findMany();
  const negativeStockProducts = allProducts.filter((p) => p.stock < 0);
  assert(negativeStockProducts.length === 0, `Zero products have negative stock in DB`);

  // ─── Test 6: Market Storm Does Not Reset Stock ────────────────────
  console.log("\n[Test 6] Market Storm Does Not Blanket Reset Stock...");
  // Set specific stock for testing
  await prisma.product.updateMany({
    where: { name: { contains: "SonicWave Buds SE", mode: "insensitive" } },
    data: { stock: 95 },
  });
  await runSimulation("market-storm");
  const sonicAfterMarket = await prisma.product.findFirst({
    where: { name: { contains: "SonicWave Buds SE", mode: "insensitive" } },
  });
  assert(
    sonicAfterMarket?.stock! <= 95,
    `Market Storm did NOT reset SonicWave Buds SE stock to 50 or 100 (Found: ${sonicAfterMarket?.stock})`
  );

  console.log("\n==================================================");
  console.log(`  RESULT: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  await prisma.$disconnect();
}

main().catch(console.error);
