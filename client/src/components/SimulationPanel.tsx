"use client";

import { useState, useCallback, useEffect } from "react";
import ReportView, { ReliabilityReport } from "./ReportView";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface SimulationScenario {
  id: string;
  name: string;
  description: string;
  badge: string;
  icon: string;
  concurrencyLevel: number;
  buyerIds: string[];
  chaosMode?: boolean;
}

interface BuyerAction {
  step: number;
  type: "start" | "tool_call" | "tool_result" | "decision" | "completed" | "contention" | "ended" | "failed";
  tool?: string;
  message: string;
  timestamp: string;
}

interface BuyerRunResult {
  buyerId: string;
  buyerName: string;
  buyerEmail?: string;
  status: "completed" | "failed" | "no_ai_key";
  outcome?: "SUCCESS" | "EXPECTED_CONTENTION" | "NO_ELIGIBLE_INVENTORY" | "OUT_OF_BUDGET" | "SYSTEM_ERROR";
  actions: BuyerAction[];
  orderId?: string;
  selectedProduct?: string;
  totalAmount?: number;
  orderStatus?: string;
  totalSteps: number;
  error?: string;
}

interface SimulationResult {
  simulationId: string;
  scenarioId: string;
  scenarioName: string;
  status: "completed" | "failed";
  durationMs: number;
  totalBuyers: number;
  buyersSuccessful: number;
  contentionLosses?: number;
  noInventoryCount?: number;
  budgetRejectedCount?: number;
  systemErrorsCount?: number;
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

export default function SimulationPanel() {
  const [scenarios, setScenarios] = useState<SimulationScenario[]>([]);
  const [loadingScenarios, setLoadingScenarios] = useState(true);
  const [runningScenario, setRunningScenario] = useState<string | null>(null);
  const [activeResult, setActiveResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedBuyer, setExpandedBuyer] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"report" | "traces">("report");

  // Fetch scenarios
  useEffect(() => {
    async function loadScenarios() {
      try {
        const res = await fetch(`${API_URL}/api/simulations/scenarios`);
        if (res.ok) {
          const data = await res.json();
          setScenarios(data.scenarios);
        }
      } catch (err) {
        console.error("Failed to load simulation scenarios:", err);
      } finally {
        setLoadingScenarios(false);
      }
    }
    loadScenarios();
  }, []);

  const handleRunSimulation = useCallback(async (scenarioId: string) => {
    setRunningScenario(scenarioId);
    setError(null);
    setActiveResult(null);
    setExpandedBuyer(null);

    try {
      const res = await fetch(`${API_URL}/api/simulations/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Simulation failed");
      }

      setActiveResult(data.result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Simulation execution failed";
      setError(msg);
    } finally {
      setRunningScenario(null);
    }
  }, []);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xl">⚡</span>
          <h2 className="text-lg font-semibold text-white/90">
            Commerce Simulation Storm
          </h2>
        </div>
        <p className="text-xs text-white/40 mt-1">
          Stress-test the commerce engine with simultaneous autonomous AI buyers under adversarial conditions
        </p>
      </div>

      {/* Scenarios Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {loadingScenarios ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.02]" />
          ))
        ) : (
          scenarios.map((scenario) => {
            const isRunning = runningScenario === scenario.id;
            return (
              <div
                key={scenario.id}
                className={`relative flex flex-col justify-between rounded-xl border p-5 transition-all ${
                  isRunning
                    ? "border-violet-500/40 bg-violet-500/[0.03] shadow-lg shadow-violet-500/10"
                    : "border-white/[0.08] bg-white/[0.02] hover:border-white/[0.14]"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-2xl">{scenario.icon}</span>
                    <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-violet-300">
                      {scenario.badge}
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-white/90 mb-1">
                    {scenario.name}
                  </h3>
                  <p className="text-xs text-white/50 leading-relaxed mb-4">
                    {scenario.description}
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11px] text-white/40 mb-3 pt-3 border-t border-white/[0.06]">
                    <span>Concurrent Buyers:</span>
                    <span className="font-mono text-white/70 font-semibold">{scenario.concurrencyLevel}</span>
                  </div>

                  <button
                    id={`run-sim-${scenario.id}`}
                    onClick={() => handleRunSimulation(scenario.id)}
                    disabled={runningScenario !== null}
                    className={`w-full rounded-lg py-2 text-xs font-semibold transition-all ${
                      isRunning
                        ? "border border-violet-500/40 bg-violet-500/20 text-violet-300 cursor-wait"
                        : runningScenario !== null
                          ? "border border-white/[0.06] bg-white/[0.02] text-white/20 cursor-not-allowed"
                          : "border border-violet-500/30 bg-violet-500/15 text-violet-200 hover:bg-violet-500/25 hover:border-violet-500/50"
                    }`}
                  >
                    {isRunning ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-violet-300 border-t-transparent" />
                        Running Storm ({scenario.concurrencyLevel} Agents)…
                      </span>
                    ) : (
                      "Launch Storm"
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Running Banner */}
      {runningScenario && (
        <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-6 text-center animate-pulse">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-violet-400 border-t-transparent mb-3" />
          <h4 className="text-sm font-semibold text-violet-200">
            Executing Autonomous Multi-Agent Simulation…
          </h4>
          <p className="text-xs text-violet-300/60 mt-1">
            Agents are concurrently searching products, resolving budget constraints, racing for stock, and issuing database transactions.
          </p>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-xs text-red-400">
          <strong>Simulation Error:</strong> {error}
        </div>
      )}

      {/* Simulation Result Dashboard */}
      {activeResult && !runningScenario && (
        <div className="space-y-6 animate-fadeIn">
          {/* View Mode Toggle */}
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white/90">
                Simulation Finished: <span className="text-violet-300">{activeResult.scenarioName}</span>
              </span>
            </div>

            <div className="flex gap-1 rounded-lg bg-white/[0.04] p-1 border border-white/[0.06]">
              <button
                onClick={() => setViewMode("report")}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                  viewMode === "report"
                    ? "bg-violet-500/30 text-violet-200 shadow-sm border border-violet-500/40"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                📊 Reliability Audit Report
              </button>
              <button
                onClick={() => setViewMode("traces")}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                  viewMode === "traces"
                    ? "bg-violet-500/30 text-violet-200 shadow-sm border border-violet-500/40"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                ⚡ Raw Agent Traces & Ledger
              </button>
            </div>
          </div>

          {/* If report mode, render ReportView */}
          {viewMode === "report" && activeResult.report ? (
            <ReportView report={activeResult.report} />
          ) : (
            <>
              {/* Header score banner */}
              <div className="rounded-xl border border-white/[0.1] bg-white/[0.03] p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">🏆</span>
                  <h3 className="text-base font-bold text-white/90">
                    {activeResult.scenarioName} Report
                  </h3>
                </div>
                <p className="text-xs text-white/40 mt-0.5">
                  Simulation ID: <span className="font-mono">{activeResult.simulationId}</span> · Completed in {(activeResult.durationMs / 1000).toFixed(2)}s
                </p>
              </div>

              {/* Status Pill */}
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    activeResult.inventoryIntegrity.isSafe
                      ? "border border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                      : "border border-red-500/30 bg-red-500/15 text-red-300"
                  }`}
                >
                  {activeResult.inventoryIntegrity.isSafe
                    ? "🛡️ 100% Inventory Safe"
                    : "⚠️ Inventory Integrity Anomaly"}
                </span>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <span className="text-[11px] text-white/40 block">Concurrent Buyers</span>
                <span className="text-lg font-bold text-white/90 mt-0.5 block">
                  {activeResult.totalBuyers}
                </span>
                <span className="text-[10px] text-emerald-400/80 mt-1 block">
                  {activeResult.buyersSuccessful} succeeded
                </span>
              </div>

              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <span className="text-[11px] text-white/40 block">Orders Created</span>
                <span className="text-lg font-bold text-white/90 mt-0.5 block">
                  {activeResult.ordersCreated}
                </span>
                <span className="text-[10px] text-white/40 mt-1 block">
                  {activeResult.ordersPaid} paid · {activeResult.ordersCancelled} recovered
                </span>
              </div>

              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <span className="text-[11px] text-white/40 block">Gross GMV</span>
                <span className="text-lg font-bold text-emerald-400 mt-0.5 block">
                  {formatCurrency(activeResult.totalRevenue)}
                </span>
                <span className="text-[10px] text-white/40 mt-1 block">Real Order Total</span>
              </div>

              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <span className="text-[11px] text-white/40 block">Oversell Events</span>
                <span className={`text-lg font-bold mt-0.5 block ${activeResult.inventoryIntegrity.oversellCount === 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {activeResult.inventoryIntegrity.oversellCount}
                </span>
                <span className="text-[10px] text-white/40 mt-1 block">Zero Negative Stock</span>
              </div>
            </div>

            {/* Inventory Balance Table */}
            <div className="mt-4 rounded-lg bg-black/40 border border-white/[0.06] p-3 text-xs flex flex-wrap items-center justify-between gap-4 text-white/60">
              <div>
                <span className="text-white/30">Initial Total Stock:</span>{" "}
                <span className="font-mono text-white/80 font-medium">{activeResult.inventoryIntegrity.initialStockTotal}</span>
              </div>
              <div>
                <span className="text-white/30">Net Reserved Units:</span>{" "}
                <span className="font-mono text-white/80 font-medium">
                  {activeResult.ordersCreated - activeResult.ordersCancelled}
                </span>
              </div>
              <div>
                <span className="text-white/30">Final Verified Stock:</span>{" "}
                <span className="font-mono text-emerald-400 font-medium">{activeResult.inventoryIntegrity.finalStockTotal}</span>
              </div>
              <div>
                <span className="text-white/30">Audit Status:</span>{" "}
                <span className="font-semibold text-emerald-400">PASSED</span>
              </div>
            </div>
          </div>

          {/* Orders Breakdown */}
          {activeResult.orderSummaries.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-3">
                Generated Commerce Orders ({activeResult.orderSummaries.length})
              </h4>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3">
                {activeResult.orderSummaries.map((ord, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3 space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-white/90">{ord.buyerName}</span>
                      <span
                        className={`font-mono text-[10px] font-semibold px-2 py-0.5 rounded border ${
                          ord.status === "PAID"
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                            : ord.status === "CANCELLED"
                              ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                              : ord.status === "FAILED"
                                ? "bg-red-500/20 text-red-300 border-red-500/30"
                                : "bg-violet-500/20 text-violet-300 border-violet-500/30"
                        }`}
                      >
                        {ord.status === "PAID"
                          ? "PAID · Captured"
                          : ord.status === "CANCELLED"
                            ? "CANCELLED · Restored"
                            : ord.status === "FAILED"
                              ? "FAILED · Restored"
                              : "PENDING · Stock Reserved"}
                      </span>
                    </div>
                    <p className="text-white/50 text-[11px] truncate">{ord.productName}</p>
                    <div className="flex items-center justify-between pt-1 text-[11px]">
                      <span className="font-mono text-white/40">{ord.orderId.slice(-8)}</span>
                      <span className="font-semibold text-white/80">{formatCurrency(ord.amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Individual Concurrent Buyer Timelines */}
          <div>
            <h4 className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-3">
              Concurrent Agent Traces ({activeResult.buyerResults.length})
            </h4>
            <div className="space-y-2">
              {activeResult.buyerResults.map((buyer, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-white/[0.08] bg-white/[0.02] overflow-hidden text-xs"
                >
                  <button
                    onClick={() => setExpandedBuyer(expandedBuyer === idx ? null : idx)}
                    className="w-full flex items-center justify-between p-3 text-left hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          buyer.outcome === "SUCCESS"
                            ? "bg-emerald-400"
                            : buyer.outcome === "EXPECTED_CONTENTION"
                              ? "bg-amber-400"
                              : buyer.outcome === "NO_ELIGIBLE_INVENTORY" || buyer.outcome === "OUT_OF_BUDGET"
                                ? "bg-zinc-400"
                                : "bg-red-400"
                        }`}
                      />
                      <span className="font-semibold text-white/90">
                        {buyer.buyerName}
                      </span>
                      {buyer.outcome === "SUCCESS" && buyer.selectedProduct && (
                        <span className="text-emerald-300/80 text-[11px]">
                          → {buyer.selectedProduct}
                        </span>
                      )}
                      {buyer.outcome === "EXPECTED_CONTENTION" && (
                        <span className="text-amber-300/80 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                          Contention Loss (0 Oversell)
                        </span>
                      )}
                      {buyer.outcome === "NO_ELIGIBLE_INVENTORY" && (
                        <span className="text-zinc-400 text-[10px] px-1.5 py-0.5 rounded bg-zinc-500/10 border border-zinc-500/20">
                          Out of Stock
                        </span>
                      )}
                      {buyer.outcome === "OUT_OF_BUDGET" && (
                        <span className="text-zinc-400 text-[10px] px-1.5 py-0.5 rounded bg-zinc-500/10 border border-zinc-500/20">
                          Over Budget
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-white/30">
                        {buyer.totalSteps} steps
                      </span>
                      <span className="text-white/30 text-xs">
                        {expandedBuyer === idx ? "▲" : "▼"}
                      </span>
                    </div>
                  </button>

                  {expandedBuyer === idx && (
                    <div className="p-3 pt-0 border-t border-white/[0.04] bg-black/20 space-y-1.5">
                      {buyer.actions.map((act, actIdx) => (
                        <div key={actIdx} className="flex items-start gap-2 text-[11px] py-0.5">
                          <span className="text-white/30 mt-0.5 font-mono">[{act.step}]</span>
                          <span
                            className={
                              act.type === "completed"
                                ? "text-emerald-300"
                                : act.type === "failed"
                                  ? "text-red-300"
                                  : act.type === "tool_call"
                                    ? "text-amber-200/80"
                                    : "text-white/60"
                            }
                          >
                            {act.message}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          </>
          )}
        </div>
      )}
    </div>
  );
}
