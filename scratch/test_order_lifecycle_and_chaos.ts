import prisma from "../server/src/lib/prisma";
import { runBuyer } from "../server/src/services/buyer";
import { runSimulation } from "../server/src/services/simulation";
import { failOrCancelOrderAndRestoreInventory } from "../server/src/services/order";

async function main() {
  console.log("==================================================");
  console.log("  AGENTSTORM — ORDER LIFECYCLE & CHAOS VERIFY     ");
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

  // 1. Setup clean baseline stock
  await prisma.product.updateMany({ data: { stock: 50 } });

  // ─── 1. Single Buyer Order Lifecycle (PENDING State) ───────────
  console.log("\n[Lifecycle 1] Single Buyer Purchase & PENDING State...");
  const res1 = await runBuyer("budget-shopper");

  assert(res1.outcome === "SUCCESS", `Buyer outcome is SUCCESS`);
  assert(!!res1.orderId, `Order ID created: ${res1.orderId}`);

  const dbOrder1 = await prisma.order.findUnique({
    where: { id: res1.orderId },
    include: { items: true },
  });

  assert(dbOrder1?.status === "PENDING", `Order status is strictly PENDING (Awaiting Payment, Stock Reserved)`);
  assert(dbOrder1?.inventoryRestored === false, `inventoryRestored is false on active PENDING order`);
  assert(dbOrder1?.items.length === 1, `Order contains exactly 1 item line`);
  assert(Number(dbOrder1?.totalAmount) === res1.totalAmount, `Order total matches buyer total amount`);

  // ─── 2. Order Cancellation & Idempotent Stock Recovery ──────────
  console.log("\n[Lifecycle 2] Order Cancellation & Stock Recovery...");
  const prodBeforeCancel = await prisma.product.findUnique({
    where: { id: dbOrder1!.items[0].productId },
  });
  const stockBeforeCancel = prodBeforeCancel!.stock;

  // Cancel order & restore stock
  await failOrCancelOrderAndRestoreInventory(res1.orderId!, "CANCELLED");

  const dbOrderCancelled = await prisma.order.findUnique({
    where: { id: res1.orderId },
  });
  assert(dbOrderCancelled?.status === "CANCELLED", `Order status transitioned to CANCELLED`);
  assert(dbOrderCancelled?.inventoryRestored === true, `inventoryRestored flag set to true`);

  const prodAfterCancel = await prisma.product.findUnique({
    where: { id: dbOrder1!.items[0].productId },
  });
  assert(prodAfterCancel!.stock === stockBeforeCancel + 1, `Stock successfully incremented by 1 on cancellation`);

  // Test double-restoration prevention (idempotency)
  let doubleRestorationPrevented = false;
  try {
    await failOrCancelOrderAndRestoreInventory(res1.orderId!, "CANCELLED");
  } catch (e: any) {
    doubleRestorationPrevented = e.message.includes("already restored");
  }
  assert(doubleRestorationPrevented, `Double inventory restoration strictly prevented by transaction guard`);

  // ─── 3. Pure 5-Buyer Flash Sale on 2 Units ───────────────────────
  console.log("\n[Lifecycle 3A] Pure 5-Agent Concurrency Storm on 2 Units of Headphones...");
  await prisma.product.updateMany({
    where: { name: { contains: "SonicWave Buds SE", mode: "insensitive" } },
    data: { stock: 2 },
  });
  await prisma.product.updateMany({
    where: { name: { contains: "SonicWave Pro", mode: "insensitive" } },
    data: { stock: 0 },
  });
  await prisma.product.updateMany({
    where: { name: { contains: "StudioCans Reference", mode: "insensitive" } },
    data: { stock: 0 },
  });

  const pureRunners = await Promise.all([
    runBuyer("budget-shopper"),
    runBuyer("budget-shopper"),
    runBuyer("budget-shopper"),
    runBuyer("budget-shopper"),
    runBuyer("budget-shopper"),
  ]);

  const pureWins = pureRunners.filter((r) => r.outcome === "SUCCESS");
  const pureLosses = pureRunners.filter((r) => r.outcome === "EXPECTED_CONTENTION");
  const pureErrors = pureRunners.filter((r) => r.outcome === "SYSTEM_ERROR");

  assert(pureWins.length === 2, `Exactly 2 buyers won the 2 available units (Wins: ${pureWins.length})`);
  assert(pureLosses.length === 3, `Exactly 3 buyers experienced EXPECTED_CONTENTION (Losses: ${pureLosses.length})`);
  assert(pureErrors.length === 0, `Zero system errors during 5-agent contention`);

  const budsStock = await prisma.product.findFirst({
    where: { name: { contains: "SonicWave Buds SE", mode: "insensitive" } },
  });
  assert(budsStock?.stock === 0, `Final target item stock is exactly 0 and NEVER negative (Stock: ${budsStock?.stock})`);

  // Restore inventory for simulation scenarios
  await prisma.product.updateMany({ data: { stock: 50 } });

  // ─── 3B. Flash Sale Simulation Scenario ──────────────────────────
  console.log("\n[Lifecycle 3B] Flash Sale Simulation Scenario...");
  const simFlash = await runSimulation("flash-sale");

  assert(simFlash.totalBuyers === 5, `Total scenario buyers: ${simFlash.totalBuyers}`);
  assert(simFlash.systemErrorsCount === 0, `Zero system errors in simulation`);
  assert(simFlash.inventoryIntegrity.oversellCount === 0, `Zero oversell events (Oversell: 0)`);
  assert(simFlash.inventoryIntegrity.isSafe, `Inventory safety verified (Safe: true)`);
  assert(simFlash.inventoryIntegrity.finalStockTotal === simFlash.inventoryIntegrity.expectedFinalStock, `Mathematical conservation exact: initial(${simFlash.inventoryIntegrity.initialStockTotal}) - ${simFlash.ordersCreated} = final(${simFlash.inventoryIntegrity.finalStockTotal})`);

  for (const ord of simFlash.orderSummaries) {
    assert(ord.status === "PENDING", `Flash sale order #${ord.orderId.slice(-8)} is PENDING (Stock Reserved)`);
  }

  // ─── 4. Payment Chaos Simulation (1 Paid, 2 Cancelled) ───────────
  console.log("\n[Lifecycle 4] Payment Chaos Simulation (1 Paid, 2 Cancelled & Restored)...");
  const simChaos = await runSimulation("payment-chaos");

  assert(simChaos.totalBuyers === 3, `Total chaos buyers: ${simChaos.totalBuyers}`);
  assert(simChaos.ordersCreated === 3, `3 orders initially placed by 3 buyers`);
  assert(simChaos.ordersPaid === 1, `Exactly 1 order successfully transitioned to PAID (Paid: 1)`);
  assert(simChaos.ordersCancelled === 2, `Exactly 2 orders transitioned to CANCELLED (Cancelled: 2)`);
  assert(simChaos.inventoryIntegrity.isSafe, `Inventory integrity preserved throughout payment chaos`);
  assert(simChaos.inventoryIntegrity.finalStockTotal === simChaos.inventoryIntegrity.expectedFinalStock, `Stock conservation exact: initial(${simChaos.inventoryIntegrity.initialStockTotal}) - 1 net paid = final(${simChaos.inventoryIntegrity.finalStockTotal})`);

  // Check database order statuses directly
  const paidSummaries = simChaos.orderSummaries.filter((o) => o.status === "PAID");
  const cancelledSummaries = simChaos.orderSummaries.filter((o) => o.status === "CANCELLED");
  assert(paidSummaries.length === 1, `1 PAID order summary in simulation result`);
  assert(cancelledSummaries.length === 2, `2 CANCELLED order summaries in simulation result`);

  for (const p of paidSummaries) {
    const dbPaid = await prisma.order.findUnique({ where: { id: p.orderId } });
    assert(dbPaid?.status === "PAID", `Database order ${p.orderId} verified as PAID`);
  }
  for (const c of cancelledSummaries) {
    const dbCancelled = await prisma.order.findUnique({ where: { id: c.orderId } });
    assert(dbCancelled?.status === "CANCELLED", `Database order ${c.orderId} verified as CANCELLED`);
    assert(dbCancelled?.inventoryRestored === true, `Database order ${c.orderId} verified inventoryRestored=true`);
  }

  // ─── 5. Token Optimization Verification ────────────────────────
  console.log("\n[Lifecycle 5] Token Optimization Verification...");
  const resPower = await runBuyer("power-user");
  const hasGroqDecision = resPower.actions.some((a) => a.message.includes("[Groq ·") || a.message.includes("fallback used"));
  assert(hasGroqDecision, `Multi-candidate decision used bounded single-turn Groq/fallback call`);
  assert(!resPower.actions.some((a) => a.message.length > 500), `Action trace contains no bloated prompt/payload logs`);

  console.log("\n==================================================");
  console.log(`  RESULT: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  await prisma.$disconnect();
}

main().catch(console.error);
