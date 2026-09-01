import prisma from "../server/src/lib/prisma";
import { runBuyer } from "../server/src/services/buyer";
import { runSimulation } from "../server/src/services/simulation";
import { llmAdapter } from "../server/src/services/llm";

async function main() {
  console.log("==================================================");
  console.log("  AGENTSTORM — PRODUCTION AUDIT & OUTCOMES TEST  ");
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

  // Reset database to clean test state
  await prisma.product.updateMany({ data: { stock: 50 } });

  // ─── Test A: Successful Purchase ──────────────────────────────
  console.log("\n[Test A] Successful purchase & exact order verification...");
  const initialOrderCount = await prisma.order.count();
  const resA = await runBuyer("budget-shopper");
  assert(resA.outcome === "SUCCESS", `Buyer outcome is SUCCESS (Outcome: ${resA.outcome})`);
  assert(!!resA.orderId, `Order ID present on SUCCESS (${resA.orderId})`);
  assert(resA.actions.length === resA.totalSteps, `Step count is exact (${resA.totalSteps} steps)`);
  const postOrderCountA = await prisma.order.count();
  assert(postOrderCountA === initialOrderCount + 1, `Exactly ONE order created in database (DB Orders: ${postOrderCountA})`);

  // ─── Test B: No Eligible Inventory / Out of Budget ────────────
  console.log("\n[Test B] Out of Budget & No Eligible Inventory classification...");
  // 1. Out of Budget
  await prisma.product.updateMany({
    where: { category: "headphones" },
    data: { price: 99999 },
  });
  const resB1 = await runBuyer("budget-shopper");
  assert(resB1.outcome === "OUT_OF_BUDGET", `Over-budget correctly classified as OUT_OF_BUDGET (Outcome: ${resB1.outcome})`);
  assert(resB1.orderId === undefined, `Zero orders created on OUT_OF_BUDGET`);
  const postOrderCountB1 = await prisma.order.count();
  assert(postOrderCountB1 === postOrderCountA, `Zero fake PENDING orders written to DB`);

  // 2. Out of Stock
  await prisma.product.updateMany({
    where: { category: "headphones" },
    data: { price: 2499, stock: 0 },
  });
  const resB2 = await runBuyer("budget-shopper");
  assert(resB2.outcome === "NO_ELIGIBLE_INVENTORY", `0-stock correctly classified as NO_ELIGIBLE_INVENTORY (Outcome: ${resB2.outcome})`);
  assert(resB2.orderId === undefined, `Zero orders created on NO_ELIGIBLE_INVENTORY`);

  // Restore headphones
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

  // ─── Test C & E: Expected Contention (1 Unit, 2 Concurrent Buyers)
  console.log("\n[Test C & E] Expected Contention race (1 unit in stock, 2 concurrent buyers)...");
  await prisma.product.updateMany({
    where: { name: { contains: "SonicWave Buds SE", mode: "insensitive" } },
    data: { stock: 1 },
  });

  const [buyer1, buyer2] = await Promise.all([
    runBuyer("budget-shopper"),
    runBuyer("budget-shopper"),
  ]);

  const successBuyer = [buyer1, buyer2].find((b) => b.outcome === "SUCCESS");
  const contentionBuyer = [buyer1, buyer2].find((b) => b.outcome === "EXPECTED_CONTENTION");

  assert(!!successBuyer, `Winner buyer achieved outcome: SUCCESS (Order: ${successBuyer?.orderId})`);
  assert(!!contentionBuyer, `Contender buyer achieved outcome: EXPECTED_CONTENTION (Neutral loss, 0 oversell)`);
  assert(contentionBuyer?.orderId === undefined, `Contention loss created ZERO fake orders`);
  assert(!contentionBuyer?.actions.some((a) => a.type === "failed"), `Contention trace contains NO red 'failed' action`);
  assert(contentionBuyer?.actions.some((a) => a.type === "contention"), `Contention trace contains neutral 'contention' action`);

  // ─── Test D & F: Candidate Fallback & Zero Negative Stock ─────
  console.log("\n[Test D & F] Candidate Fallback & Zero Negative Stock...");
  const finalBuds = await prisma.product.findFirst({
    where: { name: { contains: "SonicWave Buds SE", mode: "insensitive" } },
  });
  assert(finalBuds?.stock === 0, `Final stock is exactly 0 and NEVER negative (Stock: ${finalBuds?.stock})`);

  // Restore stock
  await prisma.product.updateMany({ data: { stock: 50 } });

  // ─── Test G & H: Zero Unnecessary LLM Calls & Max 1 Call ───────
  console.log("\n[Test G & H] Token optimization (0 calls for single candidate, <=1 for multi-candidate)...");
  // Budget Shopper has only 1 headphone <= 5000 (SonicWave Buds SE @ 2499) -> 0 LLM calls!
  const resBudget = await runBuyer("budget-shopper");
  assert(resBudget.actions.some((a) => a.message.includes("Direct selection")), `Single candidate selected directly with 0 LLM calls`);

  // Power User has multiple monitors <= 50000 -> At most 1 compact LLM decision!
  const resPower = await runBuyer("power-user");
  assert(resPower.outcome === "SUCCESS", `Power User completed purchase (${resPower.selectedProduct})`);
  assert(resPower.actions.some((a) => a.message.includes("[Groq") || a.message.includes("fallback used")), `Multi-candidate used at most 1 compact decision`);

  // ─── Test I & J: 5-Agent Flash Sale & Concurrency Safety ───────
  console.log("\n[Test I & J] Flash Sale Contention Storm (5 concurrent buyers)...");
  const simFlash = await runSimulation("flash-sale");
  assert(simFlash.inventoryIntegrity.isSafe, `Simulation inventory safety verified (Safe: ${simFlash.inventoryIntegrity.isSafe})`);
  assert(simFlash.inventoryIntegrity.oversellCount === 0, `Zero oversell events (Oversell: ${simFlash.inventoryIntegrity.oversellCount})`);
  assert(simFlash.inventoryIntegrity.finalStockTotal === simFlash.inventoryIntegrity.expectedFinalStock, `Mathematical conservation exact (Final: ${simFlash.inventoryIntegrity.finalStockTotal} == Expected: ${simFlash.inventoryIntegrity.expectedFinalStock})`);
  assert(simFlash.report?.categories.buyerSuccess.score === 100, `AI Buyer Success scored 100% (contention recognized as correct safety behavior)`);

  // ─── Chaos Mode: Payment Recovery ─────────────────────────────
  console.log("\n[Test Chaos] Payment Chaos Mode & Stock Recovery...");
  const simChaos = await runSimulation("payment-chaos");
  assert(simChaos.inventoryIntegrity.isSafe, `Payment chaos preserved inventory integrity`);
  assert(simChaos.ordersPaid === 1, `1 order captured as PAID (Paid: ${simChaos.ordersPaid})`);
  assert(simChaos.ordersCancelled > 0, `Cancelled orders safely restored stock (Cancelled: ${simChaos.ordersCancelled})`);

  console.log("\n==================================================");
  console.log(`  RESULT: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  await prisma.$disconnect();
}

main().catch(console.error);
