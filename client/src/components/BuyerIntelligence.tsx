"use client";

import { useState, useEffect, useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

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

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

const PERSONA_ICONS: Record<string, string> = {
  "budget-shopper": "💰",
  "power-user": "🖥️",
  "deal-hunter": "🔍",
  "impulse-buyer": "⚡",
};

export default function BuyerIntelligence() {
  const [analytics, setAnalytics] = useState<AggregatedBuyerAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/buyers/analytics`);
      if (res.ok) {
        const data: AggregatedBuyerAnalytics = await res.json();
        setAnalytics(data);
      }
    } catch (err) {
      console.error("Failed to fetch buyer analytics:", err);
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
        <p className="text-sm text-white/50">Aggregating AI buyer intelligence & telemetry...</p>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 text-center">
        <p className="text-sm text-white/60">No buyer telemetry recorded yet.</p>
        <p className="text-xs text-white/30 mt-1">Run AI buyer sessions to populate real-time analytics.</p>
      </div>
    );
  }

  const { overview, personaBreakdown, recentDecisions } = analytics;
  const filteredDecisions = selectedPersona
    ? recentDecisions.filter((d) => d.buyerId === selectedPersona)
    : recentDecisions;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.06] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🧠</span>
            <h2 className="text-lg font-bold tracking-tight text-white/95">
              AI Buyer Intelligence & Decision Analytics
            </h2>
          </div>
          <p className="text-xs text-white/40">
            Real-time telemetry on candidate filtering, reason chains, LLM token savings, and budget utilization.
          </p>
        </div>
        <button
          onClick={fetchAnalytics}
          className="self-start sm:self-auto rounded-lg border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 text-xs text-white/70 hover:bg-white/[0.08] hover:text-white transition-colors flex items-center gap-1.5"
        >
          <span>↻</span> Refresh Telemetry
        </button>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
          <span className="text-[11px] text-white/40 block">Total Buyer Runs</span>
          <span className="text-2xl font-black tracking-tight text-white/95 mt-1 block">
            {overview.totalBuyerRuns}
          </span>
          <span className="text-[10px] text-emerald-400 mt-1 block">
            {overview.successfulPurchases} purchases ({overview.successRatePct}%)
          </span>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
          <span className="text-[11px] text-white/40 block">Total AI GMV</span>
          <span className="text-2xl font-black tracking-tight text-emerald-400 mt-1 block">
            {formatCurrency(overview.totalGMV)}
          </span>
          <span className="text-[10px] text-white/40 mt-1 block">Committed Orders</span>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
          <span className="text-[11px] text-white/40 block">Avg Budget Util.</span>
          <span className="text-2xl font-black tracking-tight text-cyan-300 mt-1 block">
            {overview.avgBudgetUtilizationPct}%
          </span>
          <span className="text-[10px] text-white/40 mt-1 block">Capital Efficiency</span>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
          <span className="text-[11px] text-white/40 block">Contention Losses</span>
          <span className="text-2xl font-black tracking-tight text-amber-400 mt-1 block">
            {overview.contentionLosses}
          </span>
          <span className="text-[10px] text-amber-300/70 mt-1 block">0 Oversell Events</span>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
          <span className="text-[11px] text-white/40 block">LLM Calls Saved</span>
          <span className="text-2xl font-black tracking-tight text-violet-400 mt-1 block">
            {overview.llmCallsSaved}
          </span>
          <span className="text-[10px] text-violet-300/70 mt-1 block">Deterministic Bypasses</span>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
          <span className="text-[11px] text-white/40 block">Decision Modes</span>
          <div className="text-xs font-mono mt-2 space-y-0.5">
            <div className="flex justify-between text-white/70">
              <span>Groq:</span>
              <span className="text-violet-300 font-bold">{overview.groqCallsExecuted}</span>
            </div>
            <div className="flex justify-between text-white/70">
              <span>Fallback:</span>
              <span className="text-amber-300 font-bold">{overview.deterministicFallbacks}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Persona Analytics Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-semibold text-white/70 uppercase tracking-wider">
            Persona Intelligence Profiles ({personaBreakdown.length})
          </h3>
          <div className="flex gap-1.5 text-xs">
            <button
              onClick={() => setSelectedPersona(null)}
              className={`px-2.5 py-1 rounded-md text-[11px] transition-colors ${
                selectedPersona === null
                  ? "bg-violet-500/20 text-violet-300 border border-violet-500/30 font-semibold"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              All Personas
            </button>
            {personaBreakdown.map((p) => (
              <button
                key={p.personaId}
                onClick={() => setSelectedPersona(selectedPersona === p.personaId ? null : p.personaId)}
                className={`px-2.5 py-1 rounded-md text-[11px] transition-colors ${
                  selectedPersona === p.personaId
                    ? "bg-violet-500/20 text-violet-300 border border-violet-500/30 font-semibold"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                {PERSONA_ICONS[p.personaId] || "👤"} {p.personaName}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {personaBreakdown.map((persona) => (
            <div
              key={persona.personaId}
              className={`rounded-xl border p-4 transition-all ${
                selectedPersona === persona.personaId
                  ? "border-violet-500/40 bg-violet-500/5 shadow-lg shadow-violet-500/5"
                  : "border-white/[0.08] bg-white/[0.02]"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-base">{PERSONA_ICONS[persona.personaId] || "👤"}</span>
                  <span className="font-semibold text-sm text-white/90">{persona.personaName}</span>
                </div>
                <span className="text-[10px] font-mono text-white/40">
                  Max ₹{persona.budget.toLocaleString("en-IN")}
                </span>
              </div>

              {/* Progress bar */}
              <div className="space-y-1 my-3">
                <div className="flex justify-between text-[11px] text-white/50">
                  <span>Success Rate</span>
                  <span className="font-semibold text-white/80">{persona.successRatePct}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 rounded-full transition-all duration-500"
                    style={{ width: `${persona.successRatePct}%` }}
                  />
                </div>
              </div>

              {/* Persona Stats List */}
              <div className="space-y-2 text-xs pt-2 border-t border-white/[0.06]">
                <div className="flex justify-between text-white/60">
                  <span>Available Budget:</span>
                  <span className="font-mono text-white/80" title={`${persona.totalRuns} runs × ₹${persona.budget.toLocaleString("en-IN")}`}>
                    {formatCurrency(persona.availableBudget)}
                  </span>
                </div>
                <div className="flex justify-between text-white/60">
                  <span>Total Spent:</span>
                  <span className="font-semibold text-emerald-400">{formatCurrency(persona.totalSpent)}</span>
                </div>
                <div className="flex justify-between text-white/60">
                  <span>Budget Utilization:</span>
                  <span className="font-semibold text-cyan-300">
                    {persona.budgetUtilizationPct}%
                  </span>
                </div>
                <div className="flex justify-between text-white/60">
                  <span>Avg Steps:</span>
                  <span className="font-mono text-white/80">{persona.avgDecisionSteps}</span>
                </div>
                <div className="flex justify-between text-white/60">
                  <span>Contention Losses:</span>
                  <span className="font-mono text-amber-300">{persona.contentionLosses}</span>
                </div>
              </div>

              {/* Top Products */}
              {persona.topSelectedProducts.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-white/[0.06]">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40 block mb-1.5">
                    Preferred Items
                  </span>
                  <div className="space-y-1">
                    {persona.topSelectedProducts.map((prod, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[11px] text-white/70">
                        <span className="truncate max-w-[140px]">{prod.productName}</span>
                        <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-white/[0.05] text-white/50">
                          {prod.count}x
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Rejection summary */}
              {persona.commonRejectionReasons.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-white/[0.06]">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40 block mb-1.5">
                    Rejections Triggered
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {persona.commonRejectionReasons.map((rej, idx) => (
                      <span
                        key={idx}
                        className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-white/60 font-mono"
                      >
                        {rej.reason}: {rej.count}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Recent Decision Telemetry Log */}
      <div>
        <h3 className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-3">
          Detailed Decision Traces ({filteredDecisions.length})
        </h3>

        {filteredDecisions.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-xs text-white/40">
            No decision traces recorded yet for this filter.
          </div>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {filteredDecisions.map((dec) => (
              <div
                key={dec.id}
                className={`rounded-xl border p-4 text-xs transition-all ${
                  dec.outcome === "SUCCESS"
                    ? "border-emerald-500/20 bg-emerald-500/[0.02]"
                    : dec.outcome === "EXPECTED_CONTENTION"
                      ? "border-amber-500/20 bg-amber-500/[0.02]"
                      : "border-white/[0.08] bg-white/[0.02]"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{PERSONA_ICONS[dec.buyerId] || "👤"}</span>
                    <span className="font-semibold text-white/90">{dec.buyerName}</span>
                    <span className="text-white/30 text-[11px]">· {dec.goal}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                        dec.outcome === "SUCCESS"
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                          : dec.outcome === "EXPECTED_CONTENTION"
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                            : "bg-zinc-500/20 text-zinc-300 border-zinc-500/30"
                      }`}
                    >
                      {dec.outcome}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-300 border border-violet-500/20 font-mono">
                      {dec.decisionMode}
                    </span>
                    <span className="text-[10px] text-white/30">{dec.totalSteps} steps</span>
                  </div>
                </div>

                {/* Selection & Reason */}
                <div className="mt-2 rounded-lg bg-black/40 border border-white/[0.06] p-2.5 text-[11px] space-y-1">
                  <div className="flex justify-between">
                    <span className="text-white/50">Selected Product:</span>
                    <span className="font-medium text-emerald-300">
                      {dec.selectedProduct ? `${dec.selectedProduct} (${formatCurrency(dec.budgetUtilized)})` : "None"}
                    </span>
                  </div>
                  <div className="text-white/70">
                    <span className="text-violet-300">Rationale: </span>
                    {dec.selectionReason}
                  </div>
                </div>

                {/* Considered and Rejected Products */}
                <div className="mt-2.5 flex flex-wrap gap-1.5 items-center">
                  <span className="text-[10px] text-white/40">Considered ({dec.productsConsidered.length}):</span>
                  {dec.productsConsidered.map((c) => (
                    <span
                      key={c.id}
                      className="text-[10px] px-2 py-0.5 rounded bg-white/[0.04] text-white/60 border border-white/[0.06]"
                    >
                      {c.name} (₹{c.price.toLocaleString("en-IN")})
                    </span>
                  ))}
                </div>

                {dec.productsRejected.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5 items-center">
                    <span className="text-[10px] text-amber-300/60">Rejections ({dec.productsRejected.length}):</span>
                    {dec.productsRejected.map((r, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300/80 border border-amber-500/20"
                        title={r.details}
                      >
                        {r.productName}: {r.reason}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
