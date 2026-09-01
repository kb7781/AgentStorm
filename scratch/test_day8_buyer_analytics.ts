import prisma from "../server/src/lib/prisma";
import { runBuyer } from "../server/src/services/buyer";
import { runSimulation } from "../server/src/services/simulation";
import { getAggregatedBuyerAnalytics, getDecisionHistory } from "../server/src/services/buyerAnalytics";

async function main() {
  console.log("==================================================");
  console.log("  AGENTSTORM — DAY 8 BUYER ANALYTICS TEST SUITE   ");
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

  // ─── Test 1: Single Buyer Run & Decision Telemetry ─────────────
  console.log("\n[Test 1] Single Buyer Run Decision Telemetry...");
  const buyerRes = await runBuyer("budget-shopper");
  assert(buyerRes.outcome === "SUCCESS", `Buyer run completed with outcome: SUCCESS`);

  const history = getDecisionHistory("budget-shopper");
  assert(history.length > 0, `Decision history contains at least 1 record (Found: ${history.length})`);

  const latestDecision = history[0];
  assert(latestDecision.buyerId === "budget-shopper", `Decision record buyerId matches (${latestDecision.buyerId})`);
  assert(latestDecision.productsConsidered.length > 0, `Products considered recorded (${latestDecision.productsConsidered.length} items)`);
  assert(latestDecision.productsRejected.length > 0, `Products rejected recorded with reasons (${latestDecision.productsRejected.length} rejections)`);
  assert(latestDecision.budgetUtilized > 0, `Budget utilized recorded: ₹${latestDecision.budgetUtilized}`);
  assert(latestDecision.budgetUtilizationPct > 0 && latestDecision.budgetUtilizationPct <= 100, `Budget utilization % is valid: ${latestDecision.budgetUtilizationPct}%`);
  assert(!!latestDecision.selectionReason, `Selection reason captured: "${latestDecision.selectionReason.slice(0, 50)}..."`);
  assert(latestDecision.decisionMode === "direct_deterministic", `1-candidate match correctly logged mode as direct_deterministic`);

  // ─── Test 2: Multi-Candidate Decision Telemetry ─────────────────
  console.log("\n[Test 2] Multi-Candidate Decision Telemetry...");
  const powerRes = await runBuyer("power-user");
  const powerHistory = getDecisionHistory("power-user");
  assert(powerHistory.length > 0, `Power User decision history recorded`);
  const latestPower = powerHistory[0];
  assert(latestPower.decisionMode === "groq_ai" || latestPower.decisionMode === "deterministic_fallback", `Decision mode is groq_ai or deterministic_fallback (${latestPower.decisionMode})`);

  // ─── Test 3: Contention & Rejection Reasons ─────────────────────
  console.log("\n[Test 3] Contention Decision Telemetry...");
  // Limit stock of SonicWave Buds SE to 1
  await prisma.product.updateMany({
    where: { name: { contains: "SonicWave Buds SE", mode: "insensitive" } },
    data: { stock: 1 },
  });

  const [cBuyer1, cBuyer2] = await Promise.all([
    runBuyer("budget-shopper"),
    runBuyer("budget-shopper"),
  ]);

  const contentionDecision = getDecisionHistory("budget-shopper").find((d) => d.outcome === "EXPECTED_CONTENTION");
  assert(!!contentionDecision, `Contention decision recorded in history`);
  assert(contentionDecision?.productsRejected.some((r) => r.reason === "CONTENTION_LOST"), `Contention rejection reason logged as CONTENTION_LOST`);

  // Restore stock
  await prisma.product.updateMany({ data: { stock: 50 } });

  // ─── Test 4: Aggregated Analytics Computation ───────────────────
  console.log("\n[Test 4] Aggregated Buyer Analytics API & Calculations...");
  const analytics = await getAggregatedBuyerAnalytics();

  assert(analytics.overview.totalBuyerRuns > 0, `Total buyer runs > 0 (${analytics.overview.totalBuyerRuns})`);
  assert(analytics.overview.successfulPurchases > 0, `Successful purchases counted (${analytics.overview.successfulPurchases})`);
  assert(analytics.overview.totalGMV > 0, `Total AI GMV calculated (₹${analytics.overview.totalGMV.toLocaleString("en-IN")})`);
  assert(analytics.overview.avgBudgetUtilizationPct >= 0, `Avg budget utilization computed (${analytics.overview.avgBudgetUtilizationPct}%)`);
  assert(analytics.overview.llmCallsSaved >= 0, `LLM calls saved through deterministic pre-filtering tracked (${analytics.overview.llmCallsSaved})`);
  assert(analytics.personaBreakdown.length === 4, `All 4 personas represented in breakdown (${analytics.personaBreakdown.length})`);

  for (const p of analytics.personaBreakdown) {
    assert(p.personaId.length > 0, `Persona ${p.personaName} has valid ID`);
    assert(p.avgBudgetUtilizationPct >= 0 && p.avgBudgetUtilizationPct <= 100, `Persona ${p.personaName} has valid avg budget utilization (${p.avgBudgetUtilizationPct}%)`);
    assert(p.decisionModeBreakdown !== undefined, `Persona ${p.personaName} has decision mode breakdown`);
  }

  // ─── Test 5: Flash Sale Simulation Telemetry ────────────────────
  console.log("\n[Test 5] Flash Sale Simulation Telemetry...");
  const sim = await runSimulation("flash-sale");
  assert(sim.inventoryIntegrity.isSafe, `Flash sale simulation preserved inventory integrity`);
  assert(sim.inventoryIntegrity.oversellCount === 0, `Zero oversell events in flash sale`);

  const updatedAnalytics = await getAggregatedBuyerAnalytics();
  assert(updatedAnalytics.overview.totalBuyerRuns >= analytics.overview.totalBuyerRuns + 5, `Analytics aggregated all simulation buyer sessions`);

  console.log("\n==================================================");
  console.log(`  DAY 8 RESULT: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  await prisma.$disconnect();
}

main().catch(console.error);
