import prisma from "../lib/prisma";
import { logEvent } from "./events";
import { llmAdapter, CandidateProductSummary } from "./llm";
import { recordBuyerDecision, ProductRejection, BuyerDecisionRecord } from "./buyerAnalytics";

// ─── Buyer Personas ──────────────────────────────────────

export interface BuyerPersona {
  id: string;
  name: string;
  budget: number;
  category: string | null; // null = any category
  goal: string;
  behavior: string;
}

export const BUYER_PERSONAS: BuyerPersona[] = [
  {
    id: "budget-shopper",
    name: "Budget Shopper",
    budget: 5000,
    category: "headphones",
    goal: "Find an affordable pair of headphones within budget",
    behavior: "Strongly price-sensitive. Picks the cheapest in-stock option that fits the budget.",
  },
  {
    id: "power-user",
    name: "Power User",
    budget: 50000,
    category: "monitors",
    goal: "Find the best monitor within budget",
    behavior: "Prioritizes specifications and quality. Willing to spend more for better features.",
  },
  {
    id: "deal-hunter",
    name: "Deal Hunter",
    budget: 20000,
    category: null,
    goal: "Find the best value product across all categories",
    behavior: "Compares several products before deciding. Looks for the best quality-to-price ratio.",
  },
  {
    id: "impulse-buyer",
    name: "Impulse Buyer",
    budget: 15000,
    category: "keyboards",
    goal: "Buy a keyboard quickly",
    behavior: "Makes fast decisions with minimal comparison. Picks the first good option.",
  },
];

// ─── Action Timeline Types ───────────────────────────────

export type BuyerOutcome =
  | "SUCCESS"
  | "EXPECTED_CONTENTION"
  | "NO_ELIGIBLE_INVENTORY"
  | "OUT_OF_BUDGET"
  | "SYSTEM_ERROR";

export interface BuyerAction {
  step: number;
  type: "start" | "tool_call" | "tool_result" | "decision" | "completed" | "contention" | "ended" | "failed";
  tool?: string;
  args?: Record<string, unknown>;
  result?: unknown;
  message: string;
  timestamp: string;
}

export interface BuyerRunResult {
  buyerId: string;
  buyerName: string;
  buyerEmail?: string;
  status: "completed" | "failed";
  outcome: BuyerOutcome;
  actions: BuyerAction[];
  orderId?: string;
  selectedProduct?: string;
  totalAmount?: number;
  orderStatus?: string;
  totalSteps: number;
  error?: string;
  provider?: string;
  model?: string;
  fallbackUsed?: boolean;
}

// ─── Deterministic Strategy Ranking ──────────────────────

function rankCandidatesByPersona(
  candidates: CandidateProductSummary[],
  personaId: string
): CandidateProductSummary[] {
  if (personaId === "budget-shopper") {
    // Cheapest first
    return [...candidates].sort((a, b) => a.price - b.price);
  }

  if (personaId === "power-user") {
    // Most premium first within budget
    return [...candidates].sort((a, b) => b.price - a.price);
  }

  if (personaId === "deal-hunter") {
    // Value ranking: balance between lowest and highest price
    const sorted = [...candidates].sort((a, b) => a.price - b.price);
    if (sorted.length > 2) {
      const mid = Math.floor(sorted.length / 2);
      return [sorted[mid], ...sorted.filter((_, idx) => idx !== mid)];
    }
    return sorted;
  }

  // Impulse Buyer: first available candidate
  return [...candidates];
}

// ─── Atomic Database Purchase Execution ──────────────────

interface PurchaseOutcome {
  success: boolean;
  orderId?: string;
  productName?: string;
  totalAmount?: number;
  status?: string;
  error?: string;
  isContention?: boolean;
}

async function executeAtomicPurchase(
  productId: string,
  quantity: number,
  persona: BuyerPersona
): Promise<PurchaseOutcome> {
  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return { success: false, error: "Product not found" };
    }

    const totalCost = Number(product.price) * quantity;
    if (totalCost > persona.budget) {
      return {
        success: false,
        error: `Purchase would cost ₹${totalCost.toLocaleString("en-IN")} which exceeds budget of ₹${persona.budget.toLocaleString("en-IN")}`,
      };
    }

    const { Decimal } = await import("@prisma/client/runtime/library");
    const unitPrice = product.price;
    const subtotal = new Decimal(unitPrice).mul(quantity);

    // Atomic transaction: verify & decrement stock, create order in single ACID transaction
    const order = await prisma.$transaction(async (tx) => {
      const updated = await tx.product.updateMany({
        where: {
          id: productId,
          stock: { gte: quantity },
        },
        data: {
          stock: { decrement: quantity },
        },
      });

      if (updated.count === 0) {
        throw new Error(`Insufficient stock for ${product.name}`);
      }

      const newOrder = await tx.order.create({
        data: {
          email: `${persona.id}@agentstorm.ai`,
          totalAmount: subtotal,
          status: "PENDING",
          items: {
            create: [
              {
                productId,
                quantity,
                unitPrice,
                subtotal,
              },
            ],
          },
        },
      });

      return newOrder;
    });

    logEvent("ORDER_CREATED", order.id, {
      email: order.email,
      totalAmount: Number(order.totalAmount),
      buyerId: persona.id,
    });
    logEvent("STOCK_RESERVED", order.id, {
      productId,
      quantity,
    });

    return {
      success: true,
      orderId: order.id,
      productName: product.name,
      totalAmount: Number(order.totalAmount),
      status: order.status,
    };
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    const isContention = msg.includes("Insufficient stock");
    return {
      success: false,
      error: msg,
      isContention,
    };
  }
}

// ─── Main Optimized Buyer Pipeline with Decision Analytics ───

export async function runBuyer(personaId: string): Promise<BuyerRunResult> {
  const persona = BUYER_PERSONAS.find((p) => p.id === personaId);
  if (!persona) {
    return {
      buyerId: personaId,
      buyerName: "Unknown",
      status: "failed",
      outcome: "SYSTEM_ERROR",
      actions: [],
      totalSteps: 0,
      error: "Buyer persona not found",
    };
  }

  const actions: BuyerAction[] = [];
  const configuredModel = llmAdapter.getModel();
  const rejectedProducts: ProductRejection[] = [];
  let decisionMode: "direct_deterministic" | "groq_ai" | "deterministic_fallback" = "direct_deterministic";
  let selectionReason = "";

  const addAction = (
    type: BuyerAction["type"],
    message: string,
    extra?: Partial<BuyerAction>
  ) => {
    const action: BuyerAction = {
      step: actions.length + 1,
      type,
      message,
      timestamp: new Date().toISOString(),
      ...extra,
    };
    actions.push(action);
    return action;
  };

  // Step 1: Initialized buyer
  addAction(
    "start",
    `Initialized ${persona.name} (Budget: ₹${persona.budget.toLocaleString("en-IN")})`
  );

  logEvent("AI_BUYER_STARTED", persona.id, {
    buyerName: persona.name,
    budget: persona.budget,
    goal: persona.goal,
    provider: "groq",
    model: configuredModel,
  });

  try {
    // Step 2: Deterministic catalog query
    const categoryFilter = persona.category || undefined;
    addAction(
      "tool_call",
      categoryFilter ? `Searching products in "${categoryFilter}"` : "Browsing product catalog",
      { tool: "list_products", args: { category: categoryFilter } }
    );
    logEvent("AI_ACTION", persona.id, { buyerName: persona.name, action: "list_products" });

    const rawProducts = await prisma.product.findMany({
      where: categoryFilter ? { category: categoryFilter } : {},
      select: { id: true, name: true, price: true, stock: true, category: true },
      orderBy: { price: "asc" },
    });

    const productsConsidered = rawProducts.map((p) => ({
      id: p.id,
      name: p.name,
      price: Number(p.price),
      stock: p.stock,
    }));

    // Identify rejected products upfront (budget & stock)
    for (const p of rawProducts) {
      const priceNum = Number(p.price);
      if (priceNum > persona.budget) {
        rejectedProducts.push({
          productId: p.id,
          productName: p.name,
          price: priceNum,
          reason: "EXCEEDS_BUDGET",
          details: `Price ₹${priceNum.toLocaleString("en-IN")} exceeds budget ₹${persona.budget.toLocaleString("en-IN")}`,
        });
      } else if (p.stock <= 0) {
        rejectedProducts.push({
          productId: p.id,
          productName: p.name,
          price: priceNum,
          reason: "OUT_OF_STOCK",
          details: "Zero units available in inventory",
        });
      }
    }

    // Strict deterministic filtering: hard budget & in-stock
    const allCandidates: CandidateProductSummary[] = rawProducts.map((p) => ({
      id: p.id,
      name: p.name,
      price: Number(p.price),
      stock: p.stock,
      category: p.category,
    }));

    const budgetCandidates = allCandidates.filter((p) => p.price <= persona.budget);
    const inStockCandidates = budgetCandidates.filter((p) => p.stock > 0);

    addAction(
      "tool_result",
      `Found ${rawProducts.length} product(s). ${budgetCandidates.length} within budget, ${inStockCandidates.length} in stock`,
      {
        tool: "list_products",
        result: {
          total: rawProducts.length,
          withinBudget: budgetCandidates.length,
          inStock: inStockCandidates.length,
        },
      }
    );
    logEvent("AI_TOOL_RESULT", persona.id, {
      buyerName: persona.name,
      action: "list_products",
      success: true,
      count: inStockCandidates.length,
    });

    // ─── 0 Candidates within budget / stock ───────────────────
    if (inStockCandidates.length === 0) {
      decisionMode = "direct_deterministic";
      if (budgetCandidates.length === 0) {
        const reason = `No products found matching "${persona.goal}" within budget of ₹${persona.budget.toLocaleString("en-IN")}.`;
        selectionReason = reason;
        addAction("decision", reason);
        addAction("ended", `Shopping session ended — out of budget (no products under ₹${persona.budget.toLocaleString("en-IN")})`);
        logEvent("AI_BUYER_FAILED", persona.id, { buyerName: persona.name, reason, outcome: "OUT_OF_BUDGET" });

        recordBuyerDecision({
          id: `dec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          buyerId: persona.id,
          buyerName: persona.name,
          budget: persona.budget,
          goal: persona.goal,
          category: persona.category,
          productsConsidered,
          productsRejected: rejectedProducts,
          selectionReason: reason,
          budgetUtilized: 0,
          budgetUtilizationPct: 0,
          totalSteps: actions.length,
          provider: "groq",
          decisionMode: "direct_deterministic",
          outcome: "OUT_OF_BUDGET",
          timestamp: new Date().toISOString(),
        });

        return {
          buyerId: persona.id,
          buyerName: persona.name,
          buyerEmail: `${persona.id}@agentstorm.ai`,
          status: "completed",
          outcome: "OUT_OF_BUDGET",
          actions,
          totalSteps: actions.length,
          error: reason,
          provider: "groq",
          model: configuredModel,
          fallbackUsed: false,
        };
      } else {
        const reason = `All eligible products for "${persona.goal}" within budget are currently out of stock.`;
        selectionReason = reason;
        addAction("decision", reason);
        addAction("ended", "Shopping session ended — no in-stock inventory available");
        logEvent("AI_BUYER_FAILED", persona.id, { buyerName: persona.name, reason, outcome: "NO_ELIGIBLE_INVENTORY" });

        recordBuyerDecision({
          id: `dec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          buyerId: persona.id,
          buyerName: persona.name,
          budget: persona.budget,
          goal: persona.goal,
          category: persona.category,
          productsConsidered,
          productsRejected: rejectedProducts,
          selectionReason: reason,
          budgetUtilized: 0,
          budgetUtilizationPct: 0,
          totalSteps: actions.length,
          provider: "groq",
          decisionMode: "direct_deterministic",
          outcome: "NO_ELIGIBLE_INVENTORY",
          timestamp: new Date().toISOString(),
        });

        return {
          buyerId: persona.id,
          buyerName: persona.name,
          buyerEmail: `${persona.id}@agentstorm.ai`,
          status: "completed",
          outcome: "NO_ELIGIBLE_INVENTORY",
          actions,
          totalSteps: actions.length,
          error: reason,
          provider: "groq",
          model: configuredModel,
          fallbackUsed: false,
        };
      }
    }

    // ─── Determine Target Candidate Order ─────────────────────
    let rankedCandidates: CandidateProductSummary[] = [];
    let fallbackUsed = false;

    if (inStockCandidates.length === 1) {
      // Exact 1 candidate: Unambiguous match → 0 LLM calls needed!
      decisionMode = "direct_deterministic";
      rankedCandidates = inStockCandidates;
      selectionReason = `Direct selection: Only in-stock candidate within budget.`;
      addAction(
        "decision",
        `Direct selection: ${rankedCandidates[0].name} (₹${rankedCandidates[0].price.toLocaleString("en-IN")}) is the only in-stock option within budget.`
      );
    } else {
      // Multiple candidates (>1): Attempt ONE compact LLM call to choose based on persona taste
      let llmSuccess = false;

      if (llmAdapter.isAvailable()) {
        try {
          const promptInput = {
            persona: {
              name: persona.name,
              budget: persona.budget,
              goal: persona.goal,
              behavior: persona.behavior,
            },
            candidates: inStockCandidates.slice(0, 4), // Compact top candidates
          };

          const llmRes = await llmAdapter.selectProduct(promptInput);
          const chosenId = llmRes.decision.productId;
          const chosenCandidate = inStockCandidates.find((c) => c.id === chosenId);

          if (chosenCandidate) {
            decisionMode = "groq_ai";
            selectionReason = `Groq selection (${llmRes.model}): ${llmRes.decision.reason}`;
            const remaining = inStockCandidates.filter((c) => c.id !== chosenId);
            rankedCandidates = [chosenCandidate, ...rankCandidatesByPersona(remaining, persona.id)];

            // Record remaining in-stock candidates as lower ranked
            for (const rem of remaining) {
              rejectedProducts.push({
                productId: rem.id,
                productName: rem.name,
                price: rem.price,
                reason: "LOWER_RANKED",
                details: `Not selected by AI decision model for ${persona.name}`,
              });
            }

            addAction(
              "decision",
              `[Groq · ${llmRes.model}] Selected ${chosenCandidate.name} (₹${chosenCandidate.price.toLocaleString("en-IN")}): ${llmRes.decision.reason} [input≈${llmRes.estimatedInputTokens}, max_output=${llmRes.maxOutputTokens}]`
            );

            logEvent("AI_ACTION", persona.id, {
              buyerName: persona.name,
              action: "llm_decision",
              selectedProduct: chosenCandidate.name,
              provider: "groq",
              model: llmRes.model,
            });

            llmSuccess = true;
          }
        } catch (err: any) {
          const classified = llmAdapter.classifyError(err);
          fallbackUsed = true;
          decisionMode = "deterministic_fallback";
          const fallbackMsg = `Groq request failed (${classified.friendlyReason}) — deterministic fallback used`;

          console.warn(`[Groq] ${persona.name}: ${fallbackMsg}`);
          addAction("decision", fallbackMsg);

          logEvent("AI_TOOL_RESULT", persona.id, {
            buyerName: persona.name,
            action: "llm_decision",
            success: false,
            error: classified.friendlyReason,
          });
        }
      } else {
        fallbackUsed = true;
        decisionMode = "deterministic_fallback";
        addAction("decision", "Groq unconfigured — deterministic fallback used");
      }

      if (!llmSuccess) {
        decisionMode = "deterministic_fallback";
        rankedCandidates = rankCandidatesByPersona(inStockCandidates, persona.id);
        selectionReason = `Deterministic heuristic ranking for ${persona.name}`;
        addAction(
          "decision",
          `Deterministic heuristic: Selected ${rankedCandidates[0].name} (₹${rankedCandidates[0].price.toLocaleString("en-IN")}) according to ${persona.name} strategy.`
        );

        for (let i = 1; i < rankedCandidates.length; i++) {
          rejectedProducts.push({
            productId: rankedCandidates[i].id,
            productName: rankedCandidates[i].name,
            price: rankedCandidates[i].price,
            reason: "LOWER_RANKED",
            details: `Ranked below ${rankedCandidates[0].name} by heuristic`,
          });
        }
      }
    }

    // ─── Step 3: Checkout with Race Contention Iteration ───────
    let contentionOccurred = false;

    for (const candidate of rankedCandidates) {
      // 3a. Check stock
      addAction(
        "tool_call",
        `Verifying inventory availability for ${candidate.name}`,
        { tool: "check_stock", args: { productId: candidate.id } }
      );
      logEvent("AI_ACTION", persona.id, { buyerName: persona.name, action: "check_stock", productId: candidate.id });

      const currentStockCheck = await prisma.product.findUnique({
        where: { id: candidate.id },
        select: { id: true, name: true, stock: true },
      });

      const availStock = currentStockCheck?.stock ?? 0;

      if (availStock <= 0) {
        contentionOccurred = true;
        rejectedProducts.push({
          productId: candidate.id,
          productName: candidate.name,
          price: candidate.price,
          reason: "CONTENTION_LOST",
          details: "Claimed by concurrent buyer during checkout race",
        });

        addAction(
          "contention",
          `${candidate.name}: 0 units available (claimed by concurrent buyer)`,
          { tool: "check_stock", result: { stock: 0, inStock: false } }
        );
        addAction("decision", `Inventory was claimed by another concurrent buyer. Checking next eligible product...`);
        continue;
      }

      addAction(
        "tool_result",
        `${candidate.name}: ${availStock} unit(s) available`,
        { tool: "check_stock", result: { stock: availStock, inStock: true } }
      );

      // 3b. Execute atomic purchase
      addAction(
        "tool_call",
        `Executing purchase for ${candidate.name} (₹${candidate.price.toLocaleString("en-IN")})`,
        { tool: "create_order", args: { productId: candidate.id, quantity: 1 } }
      );
      logEvent("AI_ACTION", persona.id, { buyerName: persona.name, action: "create_order", productId: candidate.id });

      const outcome = await executeAtomicPurchase(candidate.id, 1, persona);

      if (!outcome.success) {
        if (outcome.isContention) {
          contentionOccurred = true;
          rejectedProducts.push({
            productId: candidate.id,
            productName: candidate.name,
            price: candidate.price,
            reason: "CONTENTION_LOST",
            details: "Lost atomic race condition during order commitment",
          });

          addAction(
            "contention",
            `Inventory was claimed by another concurrent buyer during checkout (contention on ${candidate.name})`,
            { tool: "create_order", result: { error: outcome.error } }
          );
          addAction("decision", `Checking next eligible candidate...`);
          continue;
        } else {
          addAction(
            "tool_result",
            `Purchase rejected: ${outcome.error}`,
            { tool: "create_order", result: { error: outcome.error } }
          );
          break;
        }
      }

      // Purchase Succeeded!
      const orderId = outcome.orderId!;
      const totalAmount = outcome.totalAmount!;
      const productName = outcome.productName!;
      const budgetUtilizationPct = Math.round((totalAmount / persona.budget) * 100);

      addAction(
        "tool_result",
        `Order created: ${productName} for ₹${totalAmount.toLocaleString("en-IN")}`,
        { tool: "create_order", result: { orderId, productName, totalAmount, status: outcome.status } }
      );

      addAction(
        "decision",
        `Purchased ${productName} for ₹${totalAmount.toLocaleString("en-IN")}. Matches persona goal "${persona.goal}" within budget of ₹${persona.budget.toLocaleString("en-IN")}.`
      );

      addAction(
        "completed",
        `Purchase complete — Order #${orderId.slice(-8)} for ${productName} (₹${totalAmount.toLocaleString("en-IN")})`
      );

      logEvent("AI_BUYER_COMPLETED", persona.id, {
        buyerName: persona.name,
        orderId,
        selectedProduct: productName,
        totalSteps: actions.length,
        provider: "groq",
        model: configuredModel,
        fallbackUsed,
      });

      recordBuyerDecision({
        id: `dec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        buyerId: persona.id,
        buyerName: persona.name,
        budget: persona.budget,
        goal: persona.goal,
        category: persona.category,
        productsConsidered,
        productsRejected: rejectedProducts,
        selectedProduct: productName,
        selectedProductId: candidate.id,
        selectionReason: selectionReason || `Selected best match for ${persona.name}`,
        budgetUtilized: totalAmount,
        budgetUtilizationPct,
        totalSteps: actions.length,
        provider: "groq",
        decisionMode,
        outcome: "SUCCESS",
        orderId,
        timestamp: new Date().toISOString(),
      });

      return {
        buyerId: persona.id,
        buyerName: persona.name,
        buyerEmail: `${persona.id}@agentstorm.ai`,
        status: "completed",
        outcome: "SUCCESS",
        actions,
        orderId,
        selectedProduct: productName,
        totalAmount,
        orderStatus: outcome.status || "PENDING",
        totalSteps: actions.length,
        provider: "groq",
        model: configuredModel,
        fallbackUsed,
      };
    }

    // All candidates exhausted without successful purchase
    if (contentionOccurred) {
      const reason = `Shopping session ended — expected concurrency loss (all items claimed by concurrent buyers)`;
      addAction("decision", "No remaining eligible products within budget");
      addAction("ended", reason);
      logEvent("AI_BUYER_COMPLETED", persona.id, { buyerName: persona.name, reason, outcome: "EXPECTED_CONTENTION" });

      recordBuyerDecision({
        id: `dec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        buyerId: persona.id,
        buyerName: persona.name,
        budget: persona.budget,
        goal: persona.goal,
        category: persona.category,
        productsConsidered,
        productsRejected: rejectedProducts,
        selectionReason: reason,
        budgetUtilized: 0,
        budgetUtilizationPct: 0,
        totalSteps: actions.length,
        provider: "groq",
        decisionMode,
        outcome: "EXPECTED_CONTENTION",
        timestamp: new Date().toISOString(),
      });

      return {
        buyerId: persona.id,
        buyerName: persona.name,
        buyerEmail: `${persona.id}@agentstorm.ai`,
        status: "completed",
        outcome: "EXPECTED_CONTENTION",
        actions,
        totalSteps: actions.length,
        error: reason,
        provider: "groq",
        model: configuredModel,
        fallbackUsed,
      };
    }

    const exhaustionReason = `All eligible products for "${persona.goal}" within budget are currently out of stock.`;
    addAction("decision", exhaustionReason);
    addAction("ended", "Shopping session ended without purchase (no inventory available)");
    logEvent("AI_BUYER_FAILED", persona.id, { buyerName: persona.name, reason: exhaustionReason, outcome: "NO_ELIGIBLE_INVENTORY" });

    recordBuyerDecision({
      id: `dec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      buyerId: persona.id,
      buyerName: persona.name,
      budget: persona.budget,
      goal: persona.goal,
      category: persona.category,
      productsConsidered,
      productsRejected: rejectedProducts,
      selectionReason: exhaustionReason,
      budgetUtilized: 0,
      budgetUtilizationPct: 0,
      totalSteps: actions.length,
      provider: "groq",
      decisionMode,
      outcome: "NO_ELIGIBLE_INVENTORY",
      timestamp: new Date().toISOString(),
    });

    return {
      buyerId: persona.id,
      buyerName: persona.name,
      buyerEmail: `${persona.id}@agentstorm.ai`,
      status: "completed",
      outcome: "NO_ELIGIBLE_INVENTORY",
      actions,
      totalSteps: actions.length,
      error: exhaustionReason,
      provider: "groq",
      model: configuredModel,
      fallbackUsed,
    };
  } catch (err: any) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    addAction("failed", `System error: ${errorMsg}`);
    logEvent("AI_BUYER_FAILED", persona.id, { buyerName: persona.name, error: errorMsg, outcome: "SYSTEM_ERROR" });

    recordBuyerDecision({
      id: `dec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      buyerId: persona.id,
      buyerName: persona.name,
      budget: persona.budget,
      goal: persona.goal,
      category: persona.category,
      productsConsidered: [],
      productsRejected: [],
      selectionReason: `System error: ${errorMsg}`,
      budgetUtilized: 0,
      budgetUtilizationPct: 0,
      totalSteps: actions.length,
      provider: "groq",
      decisionMode: "direct_deterministic",
      outcome: "SYSTEM_ERROR",
      timestamp: new Date().toISOString(),
    });

    return {
      buyerId: persona.id,
      buyerName: persona.name,
      buyerEmail: `${persona.id}@agentstorm.ai`,
      status: "failed",
      outcome: "SYSTEM_ERROR",
      actions,
      totalSteps: actions.length,
      error: errorMsg,
      provider: "groq",
      model: configuredModel,
      fallbackUsed: false,
    };
  }
}
