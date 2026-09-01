import {
  clearDecisionHistory,
  recordBuyerDecision,
  getAggregatedBuyerAnalytics,
  BuyerDecisionRecord,
} from "../server/src/services/buyerAnalytics";

async function main() {
  console.log("==================================================");
  console.log("  AGENTSTORM — DYNAMIC BUDGET CALCULATION TEST    ");
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

  // ─── Step 1: Initial Empty State (0 runs) ──────────────────────
  console.log("\n[Test 1] Initial Clean State (0 runs across all personas)...");
  clearDecisionHistory();

  let analytics = await getAggregatedBuyerAnalytics();
  assert(analytics.overview.totalBuyerRuns === 0, `Total buyer runs is 0`);
  assert(analytics.overview.totalAvailableBudget === 0, `Total available budget is 0`);
  assert(analytics.overview.totalGMV === 0, `Total GMV is 0`);
  assert(analytics.overview.budgetUtilizationPct === 0, `Overall budget utilization is 0%`);

  const budgetShopper0 = analytics.personaBreakdown.find((p) => p.personaId === "budget-shopper")!;
  assert(budgetShopper0.totalRuns === 0, `Budget Shopper runs = 0`);
  assert(budgetShopper0.availableBudget === 0, `Budget Shopper available budget = ₹0 (5000 × 0)`);
  assert(budgetShopper0.totalSpent === 0, `Budget Shopper total spent = ₹0`);
  assert(budgetShopper0.budgetUtilizationPct === 0, `Budget Shopper utilization = 0%`);

  // ─── Step 2: Single Run with Purchase ───────────────────────────
  console.log("\n[Test 2] Run 1 for Budget Shopper (Spent ₹2,499)...");
  const decision1: BuyerDecisionRecord = {
    id: "dec_1",
    buyerId: "budget-shopper",
    buyerName: "Budget Shopper",
    budget: 5000,
    goal: "Find headphones",
    category: "headphones",
    productsConsidered: [{ id: "p1", name: "SonicWave Buds SE", price: 2499, stock: 10 }],
    productsRejected: [],
    selectedProduct: "SonicWave Buds SE",
    selectedProductId: "p1",
    selectionReason: "Direct selection",
    budgetUtilized: 2499,
    budgetUtilizationPct: 50,
    totalSteps: 8,
    provider: "groq",
    decisionMode: "direct_deterministic",
    outcome: "SUCCESS",
    orderId: "ord_1",
    timestamp: new Date().toISOString(),
  };

  recordBuyerDecision(decision1);

  analytics = await getAggregatedBuyerAnalytics();
  const budgetShopper1 = analytics.personaBreakdown.find((p) => p.personaId === "budget-shopper")!;

  assert(budgetShopper1.totalRuns === 1, `Budget Shopper runs = 1`);
  assert(budgetShopper1.availableBudget === 5000, `Budget Shopper available budget dynamically calculated: ₹5,000 (5000 × 1)`);
  assert(budgetShopper1.totalSpent === 2499, `Budget Shopper total spent = ₹2,499`);
  assert(budgetShopper1.budgetUtilizationPct === 49.98, `Budget Shopper utilization dynamically calculated: 49.98% (2499 / 5000 × 100)`);

  // Verify other personas remain 0 (Persona isolation)
  const powerUser0 = analytics.personaBreakdown.find((p) => p.personaId === "power-user")!;
  assert(powerUser0.totalRuns === 0, `Power User runs remain 0`);
  assert(powerUser0.availableBudget === 0, `Power User available budget remains ₹0`);
  assert(powerUser0.budgetUtilizationPct === 0, `Power User utilization remains 0%`);

  // ─── Step 3: Second Run with 0 Spending (Contention Loss) ───────
  console.log("\n[Test 3] Run 2 for Budget Shopper (Contention loss, ₹0 spent)...");
  const decision2: BuyerDecisionRecord = {
    id: "dec_2",
    buyerId: "budget-shopper",
    buyerName: "Budget Shopper",
    budget: 5000,
    goal: "Find headphones",
    category: "headphones",
    productsConsidered: [{ id: "p1", name: "SonicWave Buds SE", price: 2499, stock: 0 }],
    productsRejected: [{ productId: "p1", productName: "SonicWave Buds SE", price: 2499, reason: "CONTENTION_LOST", details: "Claimed" }],
    selectionReason: "Contention loss",
    budgetUtilized: 0,
    budgetUtilizationPct: 0,
    totalSteps: 7,
    provider: "groq",
    decisionMode: "direct_deterministic",
    outcome: "EXPECTED_CONTENTION",
    timestamp: new Date().toISOString(),
  };

  recordBuyerDecision(decision2);

  analytics = await getAggregatedBuyerAnalytics();
  const budgetShopper2 = analytics.personaBreakdown.find((p) => p.personaId === "budget-shopper")!;

  assert(budgetShopper2.totalRuns === 2, `Budget Shopper runs = 2`);
  assert(budgetShopper2.availableBudget === 10000, `Budget Shopper available budget dynamically doubled: ₹10,000 (5000 × 2)`);
  assert(budgetShopper2.totalSpent === 2499, `Budget Shopper total spent remains ₹2,499`);
  assert(budgetShopper2.budgetUtilizationPct === 24.99, `Budget Shopper utilization dynamically halved: 24.99% (2499 / 10000 × 100)`);

  // ─── Step 4: Third Run with Another Purchase ───────────────────
  console.log("\n[Test 4] Run 3 for Budget Shopper (Spent ₹2,499)...");
  const decision3: BuyerDecisionRecord = {
    id: "dec_3",
    buyerId: "budget-shopper",
    buyerName: "Budget Shopper",
    budget: 5000,
    goal: "Find headphones",
    category: "headphones",
    productsConsidered: [{ id: "p1", name: "SonicWave Buds SE", price: 2499, stock: 5 }],
    productsRejected: [],
    selectedProduct: "SonicWave Buds SE",
    selectedProductId: "p1",
    selectionReason: "Direct selection",
    budgetUtilized: 2499,
    budgetUtilizationPct: 50,
    totalSteps: 8,
    provider: "groq",
    decisionMode: "direct_deterministic",
    outcome: "SUCCESS",
    orderId: "ord_3",
    timestamp: new Date().toISOString(),
  };

  recordBuyerDecision(decision3);

  analytics = await getAggregatedBuyerAnalytics();
  const budgetShopper3 = analytics.personaBreakdown.find((p) => p.personaId === "budget-shopper")!;

  assert(budgetShopper3.totalRuns === 3, `Budget Shopper runs = 3`);
  assert(budgetShopper3.availableBudget === 15000, `Budget Shopper available budget dynamically tripled: ₹15,000 (5000 × 3)`);
  assert(budgetShopper3.totalSpent === 4998, `Budget Shopper total spent = ₹4,998 (2499 + 2499)`);
  assert(budgetShopper3.budgetUtilizationPct === 33.32, `Budget Shopper utilization dynamically recalculated: 33.32% (4998 / 15000 × 100)`);

  // ─── Step 5: Multi-Persona Isolation & Overview Aggregation ────
  console.log("\n[Test 5] Multi-Persona Run & Isolation (Power User: budget 50,000, spent 38,999)...");
  const decisionPower: BuyerDecisionRecord = {
    id: "dec_power_1",
    buyerId: "power-user",
    buyerName: "Power User",
    budget: 50000,
    goal: "Find monitor",
    category: "monitors",
    productsConsidered: [{ id: "p2", name: "ClearView 32 4K Monitor", price: 38999, stock: 10 }],
    productsRejected: [],
    selectedProduct: "ClearView 32 4K Monitor",
    selectedProductId: "p2",
    selectionReason: "Groq selection",
    budgetUtilized: 38999,
    budgetUtilizationPct: 78,
    totalSteps: 10,
    provider: "groq",
    decisionMode: "groq_ai",
    outcome: "SUCCESS",
    orderId: "ord_p1",
    timestamp: new Date().toISOString(),
  };

  recordBuyerDecision(decisionPower);

  analytics = await getAggregatedBuyerAnalytics();
  const powerUser1 = analytics.personaBreakdown.find((p) => p.personaId === "power-user")!;
  const budgetShopperAfter = analytics.personaBreakdown.find((p) => p.personaId === "budget-shopper")!;

  // Power User stats
  assert(powerUser1.totalRuns === 1, `Power User runs = 1`);
  assert(powerUser1.availableBudget === 50000, `Power User available budget = ₹50,000 (50000 × 1)`);
  assert(powerUser1.totalSpent === 38999, `Power User total spent = ₹38,999`);
  assert(powerUser1.budgetUtilizationPct === 78.0, `Power User utilization = 78.0% (38999 / 50000 × 100)`);

  // Strict isolation check: Budget Shopper was not affected by Power User
  assert(budgetShopperAfter.totalRuns === 3, `Budget Shopper runs remain strictly 3`);
  assert(budgetShopperAfter.availableBudget === 15000, `Budget Shopper available budget remains ₹15,000`);
  assert(budgetShopperAfter.totalSpent === 4998, `Budget Shopper total spent remains ₹4,998`);
  assert(budgetShopperAfter.budgetUtilizationPct === 33.32, `Budget Shopper utilization remains 33.32%`);

  // Overview metrics check
  // Total available budget = 15,000 (Budget Shopper) + 50,000 (Power User) = 65,000
  // Total GMV = 4,998 + 38,999 = 43,997
  // Overall utilization = 43,997 / 65,000 * 100 = 67.69%
  assert(analytics.overview.totalBuyerRuns === 4, `Overview total runs = 4`);
  assert(analytics.overview.totalAvailableBudget === 65000, `Overview available budget = ₹65,000 (15,000 + 50,000)`);
  assert(analytics.overview.totalGMV === 43997, `Overview total GMV = ₹43,997`);
  assert(analytics.overview.budgetUtilizationPct === 67.69, `Overview budget utilization = 67.69% (43997 / 65000 × 100)`);

  console.log("\n==================================================");
  console.log(`  RESULT: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");
}

main().catch(console.error);
