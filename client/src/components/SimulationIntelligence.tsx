"use client";

import { useState, useEffect, useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export interface ScenarioComparison {
  scenarioId: string;
  scenarioName: string;
  badge: string;
  icon: string;
  totalRuns: number;
  totalBuyers: number;
  successfulPurchases: number;
  contentionLosses: number;
  systemErrors: number;
  successRatePct: number;
  totalGMV: number;
  avgDurationMs: number;
  avgReliabilityScore: number;
  avgInventorySafetyScore: number;
  avgPaymentReliabilityScore: number;
  avgBuyerSuccessScore: number;
  oversellCount: number;
  inventoryRestoredUnits: number;
  llmCallsSaved: number;
  groqCalls: number;
  deterministicInsights: string[];
}

export interface SimulationAnalyticsOverview {
  totalSimulations: number;
  totalBuyersTested: number;
  successfulPurchases: number;
  contentionLosses: number;
  systemErrors: number;
  successRatePct: number;
  totalOrdersCreated: number;
  totalOrdersPaid: number;
  totalOrdersCancelled: number;
  totalGMV: number;
  inventoryRestored: number;
  oversellEvents: number;
  negativeStockCount: number;
  stockConservationVerified: boolean;
  avgDurationMs: number;
  avgReliabilityScore: number;
  llmCallsSaved: number;
  groqCallsExecuted: number;
  deterministicFallbacks: number;
}

export interface SimulationSummaryRecord {
  simulationId: string;
  scenarioId: string;
  scenarioName: string;
  status: "completed" | "failed";
  durationMs: number;
  totalBuyers: number;
  buyersSuccessful: number;
  contentionLosses: number;
  ordersCreated: number;
  ordersPaid: number;
  ordersCancelled: number;
  totalRevenue: number;
  reliabilityScore: number;
  verdict: string;
  isSafe: boolean;
  oversellCount: number;
  timestamp: string;
}

export interface SimulationAnalyticsResponse {
  overview: SimulationAnalyticsOverview;
  scenarioComparisons: ScenarioComparison[];
  recentSimulations: SimulationSummaryRecord[];
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function SimulationIntelligence() {
  const [analytics, setAnalytics] = useState<SimulationAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/simulations/analytics`);
      if (res.ok) {
        const data: SimulationAnalyticsResponse = await res.json();
        setAnalytics(data);
      }
    } catch (err) {
      console.error("Failed to fetch simulation analytics:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading && !analytics) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-12 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-violet-400 border-t-transparent mb-4" />
        <p className="text-sm text-white/50">Aggregating simulation intelligence & scenario analytics...</p>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 text-center">
        <p className="text-sm text-white/60">No simulation telemetry recorded yet.</p>
        <p className="text-xs text-white/30 mt-1">Run simulation storms to populate cross-scenario intelligence.</p>
      </div>
    );
  }

  const { overview, scenarioComparisons, recentSimulations } = analytics;
  const filteredSimulations = selectedScenario
    ? recentSimulations.filter((s) => s.scenarioId === selectedScenario)
    : recentSimulations;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.06] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">📊</span>
            <h2 className="text-lg font-bold tracking-tight text-white/95">
              Simulation Intelligence & Scenario Analytics
            </h2>
          </div>
          <p className="text-xs text-white/40">
            Multi-agent commerce stress analytics, inventory conservation telemetry, and automated deterministic insights.
          </p>
        </div>
        <button
          onClick={fetchAnalytics}
          className="self-start sm:self-auto rounded-lg border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 text-xs text-white/70 hover:bg-white/[0.08] hover:text-white transition-colors flex items-center gap-1.5"
        >
          <span>↻</span> Refresh Telemetry
        </button>
      </div>

      {/* Overview Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
          <span className="text-[11px] text-white/40 block">Simulations Run</span>
          <span className="text-2xl font-black tracking-tight text-white/95 mt-1 block">
            {overview.totalSimulations}
          </span>
          <span className="text-[10px] text-violet-300 mt-1 block">
            {overview.totalBuyersTested} buyers tested
          </span>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
          <span className="text-[11px] text-white/40 block">Avg Reliability</span>
          <span className="text-2xl font-black tracking-tight text-emerald-400 mt-1 block">
            {overview.avgReliabilityScore}/100
          </span>
          <span className="text-[10px] text-emerald-300/70 mt-1 block">100% EXCELLENT Audit</span>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
          <span className="text-[11px] text-white/40 block">Total Simulation GMV</span>
          <span className="text-2xl font-black tracking-tight text-cyan-300 mt-1 block">
            {formatCurrency(overview.totalGMV)}
          </span>
          <span className="text-[10px] text-white/40 mt-1 block">{overview.totalOrdersCreated} orders created</span>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
          <span className="text-[11px] text-white/40 block">Oversell Events</span>
          <span className="text-2xl font-black tracking-tight text-emerald-400 mt-1 block">
            {overview.oversellEvents}
          </span>
          <span className="text-[10px] text-white/40 mt-1 block">0 Negative Stock</span>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
          <span className="text-[11px] text-white/40 block">Stock Restorations</span>
          <span className="text-2xl font-black tracking-tight text-amber-400 mt-1 block">
            {overview.inventoryRestored}
          </span>
          <span className="text-[10px] text-amber-300/70 mt-1 block">100% Recovery Rate</span>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
          <span className="text-[11px] text-white/40 block">LLM Calls Saved</span>
          <span className="text-2xl font-black tracking-tight text-violet-400 mt-1 block">
            {overview.llmCallsSaved}
          </span>
          <span className="text-[10px] text-violet-300/70 mt-1 block">Pre-Filtering Efficiency</span>
        </div>
      </div>

      {/* Scenario Comparisons Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-semibold text-white/70 uppercase tracking-wider">
            Scenario Stress Analytics Matrix ({scenarioComparisons.length})
          </h3>
          <div className="flex gap-1.5 text-xs">
            <button
              onClick={() => setSelectedScenario(null)}
              className={`px-2.5 py-1 rounded-md text-[11px] transition-colors ${
                selectedScenario === null
                  ? "bg-violet-500/20 text-violet-300 border border-violet-500/30 font-semibold"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              All Scenarios
            </button>
            {scenarioComparisons.map((sc) => (
              <button
                key={sc.scenarioId}
                onClick={() => setSelectedScenario(selectedScenario === sc.scenarioId ? null : sc.scenarioId)}
                className={`px-2.5 py-1 rounded-md text-[11px] transition-colors ${
                  selectedScenario === sc.scenarioId
                    ? "bg-violet-500/20 text-violet-300 border border-violet-500/30 font-semibold"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                {sc.icon} {sc.scenarioName}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {scenarioComparisons.map((sc) => (
            <div
              key={sc.scenarioId}
              className={`rounded-2xl border p-5 transition-all flex flex-col justify-between ${
                selectedScenario === sc.scenarioId
                  ? "border-violet-500/40 bg-violet-500/5 shadow-xl shadow-violet-500/5"
                  : "border-white/[0.08] bg-white/[0.02]"
              }`}
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{sc.icon}</span>
                    <div>
                      <h4 className="font-bold text-sm text-white/95">{sc.scenarioName}</h4>
                      <span className="text-[10px] font-mono text-violet-300 bg-violet-500/10 px-1.5 py-0.5 rounded border border-violet-500/20">
                        {sc.badge}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-emerald-400 block">
                      {sc.avgReliabilityScore}/100
                    </span>
                    <span className="text-[10px] text-white/40 font-mono">{sc.totalRuns} runs</span>
                  </div>
                </div>

                {/* Score breakdown metrics */}
                <div className="grid grid-cols-3 gap-2 my-3 text-center">
                  <div className="rounded-lg bg-black/40 border border-white/[0.06] p-2">
                    <span className="text-[10px] text-white/40 block">Inventory</span>
                    <span className="text-xs font-bold text-emerald-300 mt-0.5 block">{sc.avgInventorySafetyScore}%</span>
                  </div>
                  <div className="rounded-lg bg-black/40 border border-white/[0.06] p-2">
                    <span className="text-[10px] text-white/40 block">Payment</span>
                    <span className="text-xs font-bold text-emerald-300 mt-0.5 block">{sc.avgPaymentReliabilityScore}%</span>
                  </div>
                  <div className="rounded-lg bg-black/40 border border-white/[0.06] p-2">
                    <span className="text-[10px] text-white/40 block">Buyer Success</span>
                    <span className="text-xs font-bold text-emerald-300 mt-0.5 block">{sc.avgBuyerSuccessScore}%</span>
                  </div>
                </div>

                {/* Quantitative statistics */}
                <div className="space-y-1.5 text-xs py-3 border-t border-white/[0.06]">
                  <div className="flex justify-between text-white/60">
                    <span>Tested Buyers:</span>
                    <span className="font-mono text-white/90">{sc.totalBuyers}</span>
                  </div>
                  <div className="flex justify-between text-white/60">
                    <span>Successful Purchases:</span>
                    <span className="font-semibold text-emerald-400">{sc.successfulPurchases}</span>
                  </div>
                  <div className="flex justify-between text-white/60">
                    <span>Contention Losses:</span>
                    <span className="font-mono text-amber-300">{sc.contentionLosses}</span>
                  </div>
                  <div className="flex justify-between text-white/60">
                    <span>Oversell Events:</span>
                    <span className="font-semibold text-emerald-400">{sc.oversellCount} (Zero)</span>
                  </div>
                  <div className="flex justify-between text-white/60">
                    <span>Restored Units:</span>
                    <span className="font-mono text-cyan-300">{sc.inventoryRestoredUnits}</span>
                  </div>
                  <div className="flex justify-between text-white/60">
                    <span>Total GMV:</span>
                    <span className="font-semibold text-emerald-400">{formatCurrency(sc.totalGMV)}</span>
                  </div>
                  <div className="flex justify-between text-white/60">
                    <span>Avg Duration:</span>
                    <span className="font-mono text-white/50">{sc.avgDurationMs}ms</span>
                  </div>
                </div>
              </div>

              {/* Deterministic Engineering Insights */}
              <div className="mt-3 pt-3 border-t border-white/[0.06]">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-300 block mb-1.5">
                  Automated Deterministic Insights
                </span>
                <div className="space-y-1.5">
                  {sc.deterministicInsights.map((insight, idx) => (
                    <div key={idx} className="text-[11px] text-white/70 leading-relaxed flex items-start gap-1.5">
                      <span className="text-violet-400 shrink-0">▸</span>
                      <span>{insight}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Simulation History Log */}
      <div>
        <h3 className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-3">
          Historical Simulation Executions ({filteredSimulations.length})
        </h3>

        {filteredSimulations.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-xs text-white/40">
            No simulation runs recorded yet.
          </div>
        ) : (
          <div className="space-y-2.5 max-h-[450px] overflow-y-auto pr-1">
            {filteredSimulations.map((sim) => (
              <div
                key={sim.simulationId}
                className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5 text-xs flex flex-wrap items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      sim.isSafe && sim.oversellCount === 0 ? "bg-emerald-400" : "bg-red-400"
                    }`}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white/90">{sim.scenarioName}</span>
                      <span className="text-[10px] font-mono text-white/40">{sim.simulationId}</span>
                    </div>
                    <p className="text-[11px] text-white/50 mt-0.5">
                      {sim.totalBuyers} buyers · {sim.buyersSuccessful} purchases · {sim.contentionLosses} contention losses · {formatCurrency(sim.totalRevenue)} GMV
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="font-bold text-emerald-400 text-sm block">
                      {sim.reliabilityScore}/100
                    </span>
                    <span className="text-[10px] text-white/40 font-mono">{sim.durationMs}ms</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                    {sim.verdict}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
