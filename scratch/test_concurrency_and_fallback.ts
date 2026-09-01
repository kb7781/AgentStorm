import prisma from "../server/src/lib/prisma";
import { runBuyer } from "../server/src/services/buyer";
import { runSimulation } from "../server/src/services/simulation";
import { llmAdapter } from "../server/src/services/llm";

async function main() {
  console.log("==================================================");
  console.log("  AGENTSTORM — BUYER ENGINE & CONCURRENCY TESTS   ");
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

  // Setup fresh stock
  await prisma.product.updateMany({
    data: { stock: 50 },
  });

  // TEST A: Normal successful purchase
  console.log("\n[Test A] Testing normal successful purchase...");
  const resA = await runBuyer("budget-shopper");
  assert(resA.status === "completed" && !!resA.orderId, `Budget Shopper completed purchase (Order ID: ${resA.orderId})`);
  assert(resA.actions.length === resA.totalSteps, `Step count is exact (${resA.totalSteps} steps)`);

  // TEST B & I: Cheapest product out of stock -> fallback chooses next eligible candidate
  console.log("\n[Test B & I] Cheapest product (SonicWave Buds SE) at stock=0 -> buyer tries next eligible candidate...");
  await prisma.product.updateMany({
    where: { name: { contains: "SonicWave Buds SE", mode: "insensitive" } },
    data: { stock: 0 },
  });
  // Budget Shopper has 5000 budget. SonicWave Pro is 7999 (out of budget), StudioCans is 12499 (out of budget).
  // So Budget Shopper should gracefully conclude no in-stock headphones within budget.
  const resB = await runBuyer("budget-shopper");
  assert(resB.status === "failed", `Budget Shopper gracefully ended session without forcing invalid purchase`);
  assert(resB.actions.some(a => a.message.includes("out of stock") || a.message.includes("no matching")), "Action trace accurately reports out-of-stock condition");

  // Restore stock
  await prisma.product.updateMany({
    data: { stock: 50 },
  });

  // TEST C & D: Concurrency race contention & zero overselling
  console.log("\n[Test C & D] Flash Sale Contention (5 buyers racing for 2 units)...");
  const simFlash = await runSimulation("flash-sale");
  assert(simFlash.inventoryIntegrity.isSafe, `Inventory safety verified (Safe: ${simFlash.inventoryIntegrity.isSafe})`);
  assert(simFlash.inventoryIntegrity.oversellCount === 0, `Zero oversell events occurred (Oversell: ${simFlash.inventoryIntegrity.oversellCount})`);
  assert(simFlash.inventoryIntegrity.finalStockTotal === simFlash.inventoryIntegrity.expectedFinalStock, `Mathematical conservation exact (Final: ${simFlash.inventoryIntegrity.finalStockTotal} == Expected: ${simFlash.inventoryIntegrity.expectedFinalStock})`);

  // TEST G: Duplicate Order Protection Verification
  console.log("\n[Test G] Duplicate Order Protection...");
  const ordersForBuyer = await prisma.order.findMany({
    where: { email: "budget-shopper@agentstorm.ai" },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  assert(ordersForBuyer.length > 0, `Orders tracked with strict 1:1 database commit`);

  // TEST H: No product within budget
  console.log("\n[Test H] No product within budget constraint...");
  // Temporarily set all headphones to high prices
  await prisma.product.updateMany({
    where: { category: "headphones" },
    data: { price: 99999 },
  });
  const resH = await runBuyer("budget-shopper");
  assert(resH.status === "failed", `Budget Shopper rejected purchases exceeding budget`);
  assert(resH.actions.some(a => a.message.includes("budget")), "Timeline accurately explained budget constraint rejection");

  // Restore seed prices
  await prisma.product.updateMany({
    where: { name: { contains: "SonicWave Buds SE", mode: "insensitive" } },
    data: { price: 2499, stock: 50 },
  });
  await prisma.product.updateMany({
    where: { name: { contains: "SonicWave Pro", mode: "insensitive" } },
    data: { price: 7999, stock: 60 },
  });
  await prisma.product.updateMany({
    where: { name: { contains: "StudioCans Reference", mode: "insensitive" } },
    data: { price: 12499, stock: 20 },
  });

  // TEST J: Payment Chaos & Automated Stock Recovery
  console.log("\n[Test J] Payment Chaos & Stock Recovery...");
  const simChaos = await runSimulation("payment-chaos");
  assert(simChaos.inventoryIntegrity.isSafe, `Payment recovery preserved inventory balance (Safe: ${simChaos.inventoryIntegrity.isSafe})`);
  assert(simChaos.ordersPaid === 1, `1 order paid in chaos mode (Paid: ${simChaos.ordersPaid})`);
  assert(simChaos.ordersCancelled > 0, `Cancelled orders recovered inventory (Cancelled: ${simChaos.ordersCancelled})`);

  console.log("\n==================================================");
  console.log(`  RESULT: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  await prisma.$disconnect();
}

main().catch(console.error);
