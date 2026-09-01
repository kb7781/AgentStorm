import prisma from "../lib/prisma";
import { BUYER_PERSONAS, BuyerPersona } from "./buyer";

export interface ProductRejection {
  productId: string;
  productName: string;
  price: number;
  reason: "EXCEEDS_BUDGET" | "OUT_OF_STOCK" | "LOWER_RANKED" | "CONTENTION_LOST";
  details: string;
}

export interface BuyerDecisionRecord {
  id: string;
  buyerId: string;
  buyerName: string;
  budget: number;
  goal: string;
  category: string | null;
  productsConsidered: Array<{
    id: string;
    name: string;
    price: number;
    stock: number;
  }>;
  productsRejected: ProductRejection[];
  selectedProduct?: string;
  selectedProductId?: string;
  selectionReason: string;
  budgetUtilized: number;
  budgetUtilizationPct: number;
  totalSteps: number;
  provider: string;
  decisionMode: "direct_deterministic" | "groq_ai" | "deterministic_fallback";
  outcome: "SUCCESS" | "EXPECTED_CONTENTION" | "NO_ELIGIBLE_INVENTORY" | "OUT_OF_BUDGET" | "SYSTEM_ERROR";
  orderId?: string;
  timestamp: string;
}

export interface PersonaAnalyticsSummary {
  personaId: string;
  personaName: string;
  budget: number;
  totalRuns: number;
  availableBudget: number; // Dynamically calculated: persona.budget * totalRuns
  successfulPurchases: number;
  contentionLosses: number;
  outOfStockAttempts: number;
  overBudgetAttempts: number;
  systemErrors: number;
  successRatePct: number;
  totalSpent: number;
  budgetUtilizationPct: number; // Dynamically calculated: (totalSpent / availableBudget) * 100
  avgBudgetUtilizationPct: number;
  avgDecisionSteps: number;
  decisionModeBreakdown: {
    directDeterministic: number;
    groqAi: number;
    deterministicFallback: number;
  };
  topSelectedProducts: Array<{ productName: string; count: number }>;
  commonRejectionReasons: Array<{ reason: string; count: number }>;
}

export interface AggregatedBuyerAnalytics {
  overview: {
    totalBuyerRuns: number;
    totalAvailableBudget: number; // Sum of availableBudget across all buyer runs
    successfulPurchases: number;
    contentionLosses: number;
    noInventoryAttempts: number;
    budgetRejectedAttempts: number;
    systemErrors: number;
    successRatePct: number;
    totalGMV: number;
    budgetUtilizationPct: number; // (totalGMV / totalAvailableBudget) * 100
    avgBudgetUtilizationPct: number;
    llmCallsSaved: number;
    groqCallsExecuted: number;
    deterministicFallbacks: number;
  };
  personaBreakdown: PersonaAnalyticsSummary[];
  recentDecisions: BuyerDecisionRecord[];
}

// In-memory ring buffer of detailed decision records
const MAX_DECISION_HISTORY = 100;
let decisionHistory: BuyerDecisionRecord[] = [];

/**
 * Record a comprehensive buyer decision in the analytics buffer.
 */
export function recordBuyerDecision(decision: BuyerDecisionRecord) {
  decisionHistory.unshift(decision);
  if (decisionHistory.length > MAX_DECISION_HISTORY) {
    decisionHistory.pop();
  }
}

/**
 * Clear decision history (useful for clean unit and dynamic calculation tests).
 */
export function clearDecisionHistory() {
  decisionHistory = [];
}

/**
 * Get all cached decision records (or filtered by buyer).
 */
export function getDecisionHistory(buyerId?: string): BuyerDecisionRecord[] {
  if (buyerId) {
    return decisionHistory.filter((d) => d.buyerId === buyerId);
  }
  return [...decisionHistory];
}

/**
 * Compute aggregated analytics across in-memory decision history and PostgreSQL database events.
 * Available Budget is calculated dynamically as: persona.budget * actual number of runs for that persona.
 * Budget Utilization is calculated dynamically as: (actual total spending / available budget) * 100.
 */
export async function getAggregatedBuyerAnalytics(): Promise<AggregatedBuyerAnalytics> {
  const allRecords = decisionHistory;

  let totalBuyerRuns = allRecords.length;
  let successfulPurchases = 0;
  let contentionLosses = 0;
  let noInventoryAttempts = 0;
  let budgetRejectedAttempts = 0;
  let systemErrors = 0;
  let totalGMV = 0;
  let totalAvailableBudget = 0;
  let llmCallsSaved = 0;
  let groqCallsExecuted = 0;
  let deterministicFallbacks = 0;

  for (const rec of allRecords) {
    if (rec.outcome === "SUCCESS") {
      successfulPurchases++;
      totalGMV += rec.budgetUtilized;
    } else if (rec.outcome === "EXPECTED_CONTENTION") {
      contentionLosses++;
    } else if (rec.outcome === "NO_ELIGIBLE_INVENTORY") {
      noInventoryAttempts++;
    } else if (rec.outcome === "OUT_OF_BUDGET") {
      budgetRejectedAttempts++;
    } else if (rec.outcome === "SYSTEM_ERROR") {
      systemErrors++;
    }

    if (rec.decisionMode === "direct_deterministic") {
      llmCallsSaved++;
    } else if (rec.decisionMode === "groq_ai") {
      groqCallsExecuted++;
    } else if (rec.decisionMode === "deterministic_fallback") {
      deterministicFallbacks++;
    }
  }

  // Build persona breakdown with strictly dynamic available budget and budget utilization calculations
  const personaBreakdown: PersonaAnalyticsSummary[] = BUYER_PERSONAS.map((persona) => {
    // Strictly isolate only this specific persona's decision records
    const pRecords = allRecords.filter((r) => r.buyerId === persona.id);
    const pRuns = pRecords.length;

    // Available Budget = persona.budget * actual number of runs for that persona
    const availableBudget = persona.budget * pRuns;
    totalAvailableBudget += availableBudget;

    const pWins = pRecords.filter((r) => r.outcome === "SUCCESS").length;
    const pContention = pRecords.filter((r) => r.outcome === "EXPECTED_CONTENTION").length;
    const pNoStock = pRecords.filter((r) => r.outcome === "NO_ELIGIBLE_INVENTORY").length;
    const pOverBudget = pRecords.filter((r) => r.outcome === "OUT_OF_BUDGET").length;
    const pErrors = pRecords.filter((r) => r.outcome === "SYSTEM_ERROR").length;

    // Actual total spending for this persona
    const pSpent = pRecords
      .filter((r) => r.outcome === "SUCCESS")
      .reduce((sum, r) => sum + r.budgetUtilized, 0);

    // Budget Utilization = (actual total spending / available budget) * 100
    const rawUtilization = availableBudget > 0 ? (pSpent / availableBudget) * 100 : 0;
    const budgetUtilizationPct = Math.round(rawUtilization * 100) / 100;
    const avgBudgetUtilizationPct = Math.round(rawUtilization);

    const pStepsSum = pRecords.reduce((sum, r) => sum + r.totalSteps, 0);
    const pAvgSteps = pRuns > 0 ? Math.round((pStepsSum / pRuns) * 10) / 10 : 0;

    const directDeterministic = pRecords.filter((r) => r.decisionMode === "direct_deterministic").length;
    const groqAi = pRecords.filter((r) => r.decisionMode === "groq_ai").length;
    const deterministicFallback = pRecords.filter((r) => r.decisionMode === "deterministic_fallback").length;

    // Top products
    const productCounts: Record<string, number> = {};
    for (const r of pRecords) {
      if (r.selectedProduct && r.outcome === "SUCCESS") {
        productCounts[r.selectedProduct] = (productCounts[r.selectedProduct] || 0) + 1;
      }
    }
    const topSelectedProducts = Object.entries(productCounts)
      .map(([productName, count]) => ({ productName, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    // Common rejection reasons
    const rejectionCounts: Record<string, number> = {};
    for (const r of pRecords) {
      for (const rej of r.productsRejected) {
        rejectionCounts[rej.reason] = (rejectionCounts[rej.reason] || 0) + 1;
      }
    }
    const commonRejectionReasons = Object.entries(rejectionCounts)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);

    return {
      personaId: persona.id,
      personaName: persona.name,
      budget: persona.budget,
      totalRuns: pRuns,
      availableBudget,
      successfulPurchases: pWins,
      contentionLosses: pContention,
      outOfStockAttempts: pNoStock,
      overBudgetAttempts: pOverBudget,
      systemErrors: pErrors,
      successRatePct: pRuns > 0 ? Math.round((pWins / pRuns) * 100) : 0,
      totalSpent: pSpent,
      budgetUtilizationPct,
      avgBudgetUtilizationPct,
      avgDecisionSteps: pAvgSteps,
      decisionModeBreakdown: {
        directDeterministic,
        groqAi,
        deterministicFallback,
      },
      topSelectedProducts,
      commonRejectionReasons,
    };
  });

  const successRatePct = totalBuyerRuns > 0 ? Math.round((successfulPurchases / totalBuyerRuns) * 100) : 0;
  const overallUtilization = totalAvailableBudget > 0 ? (totalGMV / totalAvailableBudget) * 100 : 0;
  const budgetUtilizationPct = Math.round(overallUtilization * 100) / 100;
  const avgBudgetUtilizationPct = Math.round(overallUtilization);

  return {
    overview: {
      totalBuyerRuns,
      totalAvailableBudget,
      successfulPurchases,
      contentionLosses,
      noInventoryAttempts,
      budgetRejectedAttempts,
      systemErrors,
      successRatePct,
      totalGMV,
      budgetUtilizationPct,
      avgBudgetUtilizationPct,
      llmCallsSaved,
      groqCallsExecuted,
      deterministicFallbacks,
    },
    personaBreakdown,
    recentDecisions: allRecords.slice(0, 20),
  };
}
