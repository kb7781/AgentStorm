import prisma from "../lib/prisma";
import { logEvent } from "./events";
import { runBuyer, BuyerRunResult, BUYER_PERSONAS } from "./buyer";
import { failOrCancelOrderAndRestoreInventory } from "./order";
import { generateReliabilityReport, ReliabilityReport } from "./analysis";

export interface SimulationScenario {
  id: string;
  name: string;
  description: string;
  badge: string;
  icon: string;
  concurrencyLevel: number;
  buyerIds: string[];
  chaosMode?: boolean;
  stockLimitSetup?: {
    category?: string;
    productNameSnippet?: string;
    stock: number;
  };
}

export const SIMULATION_SCENARIOS: SimulationScenario[] = [
  {
    id: "flash-sale",
    name: "Flash Sale Contention",
    description: "5 concurrent AI buyers race to purchase an item with only 2 units in stock. Tests atomic inventory locks and zero-oversell guarantees.",
    badge: "High Contention",
    icon: "🔥",
    concurrencyLevel: 5,
    buyerIds: [
      "budget-shopper",
      "budget-shopper",
      "deal-hunter",
      "impulse-buyer",
      "budget-shopper",
    ],
    stockLimitSetup: {
      productNameSnippet: "SonicWave Buds SE",
      stock: 2,
    },
  },
  {
    id: "market-storm",
    name: "Mixed Market Storm",
    description: "All 4 distinct AI buyer personas execute real autonomous purchases simultaneously across diverse catalog categories.",
    badge: "Multi-Category Load",
    icon: "🌪️",
    concurrencyLevel: 4,
    buyerIds: [
      "budget-shopper",
      "power-user",
      "deal-hunter",
      "impulse-buyer",
    ],
  },
  {
    id: "payment-chaos",
    name: "Payment Drop & Inventory Recovery",
    description: "Concurrent buyers place orders, followed by simulated payment failures to stress-test automated Day 3 stock recovery during traffic spikes.",
    badge: "Chaos Engineering",
    icon: "⚡",
    concurrencyLevel: 3,
    buyerIds: [
      "budget-shopper",
      "deal-hunter",
      "impulse-buyer",
    ],
    chaosMode: true,
  },
];

export interface SimulationResult {
  simulationId: string;
  scenarioId: string;
  scenarioName: string;
  status: "completed" | "failed";
  durationMs: number;
  totalBuyers: number;
  buyersSuccessful: number;
  contentionLosses: number;
  noInventoryCount: number;
  budgetRejectedCount: number;
  systemErrorsCount: number;
  buyersFailed: number;
  ordersCreated: number;
  ordersPaid: number;
  ordersCancelled: number;
  totalRevenue: number;
  inventoryIntegrity: {
    isSafe: boolean;
    oversellCount: number;
    initialStockTotal: number;
    finalStockTotal: number;
    expectedFinalStock: number;
  };
  buyerResults: BuyerRunResult[];
  orderSummaries: Array<{
    orderId: string;
    buyerName: string;
    productName: string;
    amount: number;
    status: string;
  }>;
  report?: ReliabilityReport;
  error?: string;
}

export const simulationsRegistry = new Map<string, { result: SimulationResult; report: ReliabilityReport }>();

export function getSimulationRecord(simulationId: string) {
  return simulationsRegistry.get(simulationId);
}

let simulationExecutionQueue: Promise<any> = Promise.resolve();

export async function runSimulation(scenarioId: string): Promise<SimulationResult> {
  const currentRun = simulationExecutionQueue.then(() => executeSimulationScenario(scenarioId));
  simulationExecutionQueue = currentRun.catch(() => {});
  return currentRun;
}

async function executeSimulationScenario(scenarioId: string): Promise<SimulationResult> {
  const scenario = SIMULATION_SCENARIOS.find((s) => s.id === scenarioId);
  if (!scenario) {
    throw new Error(`Scenario '${scenarioId}' not found`);
  }

  const simulationId = `sim_${Date.now()}`;
  const startTime = Date.now();

  logEvent("SIMULATION_STARTED", simulationId, {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    concurrencyLevel: scenario.concurrencyLevel,
  });

  try {
    // 1. Setup baseline stock before simulation
    if (scenario.stockLimitSetup) {
      if (scenario.stockLimitSetup.productNameSnippet) {
        await prisma.product.updateMany({
          where: {
            name: { contains: scenario.stockLimitSetup.productNameSnippet, mode: "insensitive" },
          },
          data: {
            stock: scenario.stockLimitSetup.stock,
          },
        });
      }
    } else {
      await prisma.product.updateMany({
        where: { stock: { lte: 2 } },
        data: { stock: 50 },
      });
    }

    // 2. Snapshot Initial Stock across all active products
    const initialProducts = await prisma.product.findMany({
      select: { id: true, name: true, stock: true },
    });
    const initialStockTotal = initialProducts.reduce((sum, p) => sum + p.stock, 0);

    // 3. Launch concurrent AI Buyers simultaneously
    const buyerPromises = scenario.buyerIds.map((buyerId, index) =>
      new Promise<BuyerRunResult>((resolve) => {
        setTimeout(async () => {
          try {
            const res = await runBuyer(buyerId);
            resolve(res);
          } catch (err) {
            resolve({
              buyerId,
              buyerName: BUYER_PERSONAS.find((p) => p.id === buyerId)?.name || buyerId,
              status: "failed",
              outcome: "SYSTEM_ERROR",
              actions: [],
              totalSteps: 0,
              error: err instanceof Error ? err.message : "Buyer execution failed",
            });
          }
        }, index * 80);
      })
    );

    const buyerOutcomes = await Promise.all(buyerPromises);

    // 4. Process Orders & Chaos Handling
    let ordersCreated = 0;
    let ordersPaid = 0;
    let ordersCancelled = 0;
    let totalRevenue = 0;
    let paidCount = 0;
    const orderSummaries: SimulationResult["orderSummaries"] = [];

    for (let i = 0; i < buyerOutcomes.length; i++) {
      const b = buyerOutcomes[i];
      if (b.orderId) {
        ordersCreated++;
        const amount = b.totalAmount || 0;
        totalRevenue += amount;

        let finalOrderStatus = "PENDING";

        // In Chaos Mode: simulate 1 payment success, others payment drops/cancellations
        if (scenario.chaosMode) {
          if (paidCount === 0) {
            // First successfully created order is captured as PAID
            await prisma.order.update({
              where: { id: b.orderId },
              data: { status: "PAID" },
            });
            finalOrderStatus = "PAID";
            ordersPaid++;
            paidCount++;
            logEvent("PAYMENT_SUCCESS", b.orderId, { simulated: true });
            logEvent("ORDER_PAID", b.orderId, { simulated: true });
          } else {
            // Subsequent created orders fail payment -> automated stock recovery
            await failOrCancelOrderAndRestoreInventory(b.orderId, "CANCELLED");
            finalOrderStatus = "CANCELLED";
            ordersCancelled++;
            logEvent("PAYMENT_FAILED", b.orderId, { simulated: true, reason: "Card dropped" });
            logEvent("ORDER_CANCELLED", b.orderId, { simulated: true });
            logEvent("STOCK_RESTORED", b.orderId, { simulated: true });
          }
        } else {
          finalOrderStatus = "PENDING";
        }

        orderSummaries.push({
          orderId: b.orderId,
          buyerName: b.buyerName,
          productName: b.selectedProduct || "Product",
          amount,
          status: finalOrderStatus,
        });
      }
    }

    // 5. Snapshot Final Stock and verify Inventory Integrity
    const finalProducts = await prisma.product.findMany({
      select: { id: true, name: true, stock: true },
    });
    const finalStockTotal = finalProducts.reduce((sum, p) => sum + p.stock, 0);

    const activeOrderIds = orderSummaries
      .filter((o) => o.status !== "CANCELLED")
      .map((o) => o.orderId);

    const activeOrderItems = activeOrderIds.length > 0
      ? await prisma.orderItem.findMany({
          where: { orderId: { in: activeOrderIds } },
          select: { quantity: true },
        })
      : [];

    const netPurchasedUnits = activeOrderItems.reduce((sum, it) => sum + it.quantity, 0);
    const expectedFinalStock = initialStockTotal - netPurchasedUnits;

    const negativeStockProducts = finalProducts.filter((p) => p.stock < 0);
    const oversellCount = negativeStockProducts.length;
    const isSafe = oversellCount === 0 && finalStockTotal === expectedFinalStock;

    const durationMs = Date.now() - startTime;
    const buyersSuccessful = buyerOutcomes.filter((b) => b.outcome === "SUCCESS").length;
    const contentionLosses = buyerOutcomes.filter((b) => b.outcome === "EXPECTED_CONTENTION").length;
    const noInventoryCount = buyerOutcomes.filter((b) => b.outcome === "NO_ELIGIBLE_INVENTORY").length;
    const budgetRejectedCount = buyerOutcomes.filter((b) => b.outcome === "OUT_OF_BUDGET").length;
    const systemErrorsCount = buyerOutcomes.filter((b) => b.outcome === "SYSTEM_ERROR").length;
    const buyersFailed = systemErrorsCount;

    const report = await generateReliabilityReport({
      simulationId,
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      totalBuyers: scenario.buyerIds.length,
      buyersSuccessful,
      buyersFailed,
      ordersCreated,
      ordersPaid,
      ordersCancelled,
      totalRevenue,
      durationMs,
      inventoryIntegrity: {
        isSafe,
        oversellCount,
        initialStockTotal,
        finalStockTotal,
        expectedFinalStock,
      },
      buyerResults: buyerOutcomes,
      orderSummaries,
    });

    const result: SimulationResult = {
      simulationId,
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      status: "completed",
      durationMs,
      totalBuyers: scenario.buyerIds.length,
      buyersSuccessful,
      contentionLosses,
      noInventoryCount,
      budgetRejectedCount,
      systemErrorsCount,
      buyersFailed,
      ordersCreated,
      ordersPaid,
      ordersCancelled,
      totalRevenue,
      inventoryIntegrity: {
        isSafe,
        oversellCount,
        initialStockTotal,
        finalStockTotal,
        expectedFinalStock,
      },
      buyerResults: buyerOutcomes,
      orderSummaries,
      report,
    };

    simulationsRegistry.set(simulationId, { result, report });

    logEvent("SIMULATION_COMPLETED", simulationId, {
      scenarioId: scenario.id,
      durationMs,
      isSafe,
      ordersCreated,
      buyersSuccessful,
      contentionLosses,
      overallScore: report.overallScore,
    });

    return result;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Simulation run failed";
    console.error("Simulation failed:", err);

    logEvent("SIMULATION_FAILED", simulationId, {
      scenarioId: scenario.id,
      error: errorMsg,
    });

    return {
      simulationId,
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      status: "failed",
      durationMs: Date.now() - startTime,
      totalBuyers: scenario.buyerIds.length,
      buyersSuccessful: 0,
      contentionLosses: 0,
      noInventoryCount: 0,
      budgetRejectedCount: 0,
      systemErrorsCount: scenario.buyerIds.length,
      buyersFailed: scenario.buyerIds.length,
      ordersCreated: 0,
      ordersPaid: 0,
      ordersCancelled: 0,
      totalRevenue: 0,
      inventoryIntegrity: {
        isSafe: false,
        oversellCount: 0,
        initialStockTotal: 0,
        finalStockTotal: 0,
        expectedFinalStock: 0,
      },
      buyerResults: [],
      orderSummaries: [],
      error: errorMsg,
    };
  }
}
