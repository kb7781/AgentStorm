import prisma from "../server/src/lib/prisma";
import { runSimulation } from "../server/src/services/simulation";
import { getSimulationAnalytics } from "../server/src/services/simulationAnalytics";

async function main() {
  console.log("==================================================");
  console.log("  AGENTSTORM — DAY 9 SIMULATION ANALYTICS TEST   ");
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

  // 1. Reset baseline stock
  await prisma.product.updateMany({ data: { stock: 50 } });

  // ─── Step 1: Run All 3 Simulation Scenarios ───────────────────
  console.log("\n[Step 1] Executing Simulation Storm Scenarios...");
  const simFlash = await runSimulation("flash-sale");
  assert(simFlash.inventoryIntegrity.isSafe, `Flash Sale inventory integrity isSafe: true`);
  assert(simFlash.inventoryIntegrity.oversellCount === 0, `Flash Sale oversellCount: 0`);

  // Reset stock before Market Storm (simulations no longer silently reset stock)
  await prisma.product.updateMany({ data: { stock: 50 } });
  const simMarket = await runSimulation("market-storm");
  assert(simMarket.inventoryIntegrity.isSafe, `Market Storm inventory integrity isSafe: true`);
  assert(simMarket.inventoryIntegrity.oversellCount === 0, `Market Storm oversellCount: 0`);

  // Reset stock before Payment Chaos (simulations no longer silently reset stock)
  await prisma.product.updateMany({ data: { stock: 50 } });
  const simChaos = await runSimulation("payment-chaos");
  assert(simChaos.inventoryIntegrity.isSafe, `Payment Chaos inventory integrity isSafe: true`);
  assert(simChaos.ordersPaid === 1, `Payment Chaos 1 paid order confirmed`);
  assert(simChaos.ordersCancelled === 2, `Payment Chaos 2 cancelled orders confirmed`);

  // ─── Step 2: Query Simulation Intelligence Analytics ───────────
  console.log("\n[Step 2] Querying GET /api/simulations/analytics Aggregations...");
  const analytics = await getSimulationAnalytics();

  // Overview assertions
  assert(analytics.overview.totalSimulations >= 3, `Total simulations >= 3 (Found: ${analytics.overview.totalSimulations})`);
  assert(analytics.overview.totalBuyersTested >= 12, `Total buyers tested >= 12 (Found: ${analytics.overview.totalBuyersTested})`);
  assert(analytics.overview.successfulPurchases > 0, `Successful purchases counted (${analytics.overview.successfulPurchases})`);
  assert(analytics.overview.contentionLosses > 0, `Contention losses counted (${analytics.overview.contentionLosses})`);
  assert(analytics.overview.oversellEvents === 0, `Zero oversell events verified (Oversell: 0)`);
  assert(analytics.overview.negativeStockCount === 0, `Zero negative stock count verified (Negative: 0)`);
  assert(analytics.overview.stockConservationVerified === true, `Stock conservation verified across all runs (Safe: true)`);
  assert(analytics.overview.totalGMV > 0, `Total simulation GMV calculated: ₹${analytics.overview.totalGMV.toLocaleString("en-IN")}`);
  assert(analytics.overview.inventoryRestored >= 2, `Restored inventory units tracked (${analytics.overview.inventoryRestored})`);
  assert(analytics.overview.avgReliabilityScore >= 90, `Average reliability score is EXCELLENT: ${analytics.overview.avgReliabilityScore}/100`);
  assert(analytics.overview.llmCallsSaved > 0, `LLM calls saved through pre-filtering tracked (${analytics.overview.llmCallsSaved})`);

  // Scenario comparisons assertions
  assert(analytics.scenarioComparisons.length === 3, `All 3 scenarios represented in comparisons matrix`);

  const flashComp = analytics.scenarioComparisons.find((s) => s.scenarioId === "flash-sale")!;
  assert(flashComp.totalRuns >= 1, `Flash Sale total runs >= 1`);
  assert(flashComp.oversellCount === 0, `Flash Sale oversell count is 0`);
  assert(flashComp.contentionLosses > 0, `Flash Sale contention losses recorded (${flashComp.contentionLosses})`);
  assert(flashComp.deterministicInsights.length > 0, `Flash Sale has deterministic automated insights`);
  assert(flashComp.deterministicInsights.some((i) => i.includes("0 oversell")), `Flash Sale insight highlights 0 oversell`);

  const marketComp = analytics.scenarioComparisons.find((s) => s.scenarioId === "market-storm")!;
  assert(marketComp.totalRuns >= 1, `Market Storm total runs >= 1`);
  assert(marketComp.totalGMV > 0, `Market Storm GMV calculated: ₹${marketComp.totalGMV.toLocaleString("en-IN")}`);
  assert(marketComp.deterministicInsights.length > 0, `Market Storm has deterministic automated insights`);

  const chaosComp = analytics.scenarioComparisons.find((s) => s.scenarioId === "payment-chaos")!;
  assert(chaosComp.totalRuns >= 1, `Payment Chaos total runs >= 1`);
  assert(chaosComp.inventoryRestoredUnits >= 2, `Payment Chaos restored units tracked (${chaosComp.inventoryRestoredUnits})`);
  assert(chaosComp.deterministicInsights.length > 0, `Payment Chaos has deterministic automated insights`);
  assert(chaosComp.deterministicInsights.some((i) => i.includes("Automated stock recovery") || i.includes("restored")), `Payment Chaos insight highlights automated stock recovery`);

  // Recent simulations list assertions
  assert(analytics.recentSimulations.length >= 3, `Recent simulations records populated (${analytics.recentSimulations.length})`);
  for (const rec of analytics.recentSimulations.slice(0, 3)) {
    assert(rec.reliabilityScore >= 90, `Recent simulation ${rec.scenarioName} reliability score >= 90 (${rec.reliabilityScore})`);
    assert(rec.isSafe === true, `Recent simulation ${rec.scenarioName} isSafe === true`);
  }

  console.log("\n==================================================");
  console.log(`  DAY 9 RESULT: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  await prisma.$disconnect();
}

main().catch(console.error);
