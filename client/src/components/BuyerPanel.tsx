"use client";

import { useState, useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface BuyerPersona {
  id: string;
  name: string;
  budget: number;
  category: string | null;
  goal: string;
  behavior: string;
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
  status: "completed" | "failed";
  outcome?: "SUCCESS" | "EXPECTED_CONTENTION" | "NO_ELIGIBLE_INVENTORY" | "OUT_OF_BUDGET" | "SYSTEM_ERROR";
  actions: BuyerAction[];
  orderId?: string;
  selectedProduct?: string;
  selectionReason?: string;
  decisionMode?: "direct_deterministic" | "groq_ai" | "deterministic_fallback";
  totalAmount?: number;
  orderStatus?: string;
  totalSteps: number;
  error?: string;
  provider?: string;
  model?: string;
  fallbackUsed?: boolean;
}

const PERSONAS: BuyerPersona[] = [
  {
    id: "budget-shopper",
    name: "Budget Shopper",
    budget: 5000,
    category: "headphones",
    goal: "Find affordable headphones",
    behavior: "Strongly price-sensitive",
  },
  {
    id: "power-user",
    name: "Power User",
    budget: 50000,
    category: "monitors",
    goal: "Find the best monitor",
    behavior: "Prioritizes specifications",
  },
  {
    id: "deal-hunter",
    name: "Deal Hunter",
    budget: 20000,
    category: null,
    goal: "Find the best value product",
    behavior: "Compares before deciding",
  },
  {
    id: "impulse-buyer",
    name: "Impulse Buyer",
    budget: 15000,
    category: "keyboards",
    goal: "Buy a keyboard quickly",
    behavior: "Fast decisions",
  },
];

const PERSONA_ICONS: Record<string, string> = {
  "budget-shopper": "💰",
  "power-user": "🖥️",
  "deal-hunter": "🔍",
  "impulse-buyer": "⚡",
};

function ActionIcon({ type }: { type: BuyerAction["type"] }) {
  switch (type) {
    case "start":
      return <span className="text-violet-400">▶</span>;
    case "tool_call":
      return <span className="text-amber-400">→</span>;
    case "tool_result":
      return <span className="text-blue-400">✓</span>;
    case "decision":
      return <span className="text-cyan-400">💭</span>;
    case "completed":
      return <span className="text-emerald-400">✓</span>;
    case "contention":
      return <span className="text-amber-400">⚡</span>;
    case "ended":
      return <span className="text-zinc-400">⏹</span>;
    case "failed":
      return <span className="text-red-400">✕</span>;
  }
}

function ActionLine({ action }: { action: BuyerAction }) {
  const colorMap: Record<string, string> = {
    start: "text-violet-300",
    tool_call: "text-amber-200/80",
    tool_result: "text-blue-200/70",
    decision: "text-cyan-200/70",
    completed: "text-emerald-300",
    contention: "text-amber-200",
    ended: "text-zinc-300",
    failed: "text-red-300",
  };

  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <div className="mt-0.5 shrink-0 text-xs">
        <ActionIcon type={action.type} />
      </div>
      <p className={`text-xs leading-relaxed ${colorMap[action.type] || "text-white/60"}`}>
        {action.type === "decision" && action.message.length > 200
          ? action.message.slice(0, 200) + "…"
          : action.message}
      </p>
    </div>
  );
}

export default function BuyerPanel() {
  const [runningBuyer, setRunningBuyer] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, BuyerRunResult>>({});

  const handleRunBuyer = useCallback(async (buyerId: string) => {
    setRunningBuyer(buyerId);
    setResults((prev) => {
      const next = { ...prev };
      delete next[buyerId];
      return next;
    });

    try {
      const res = await fetch(`${API_URL}/api/buyers/${buyerId}/run`, {
        method: "POST",
      });

      const data = await res.json();
      const result: BuyerRunResult = data.result || data;

      setResults((prev) => ({ ...prev, [buyerId]: result }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to run buyer";
      setResults((prev) => ({
        ...prev,
        [buyerId]: {
          buyerId,
          buyerName: PERSONAS.find((p) => p.id === buyerId)?.name || buyerId,
          status: "failed",
          actions: [
            {
              step: 0,
              type: "failed",
              message: `Network error: ${message}`,
              timestamp: new Date().toISOString(),
            },
          ],
          totalSteps: 0,
          error: message,
        },
      }));
    } finally {
      setRunningBuyer(null);
    }
  }, []);

  const formatBudget = (amount: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white/90">AI Buyers</h2>
        <p className="text-xs text-white/40 mt-0.5">
          Autonomous AI agents that shop using real commerce APIs
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {PERSONAS.map((persona) => {
          const result = results[persona.id];
          const isRunning = runningBuyer === persona.id;

          return (
            <div
              key={persona.id}
              className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 transition-colors hover:border-white/[0.12]"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/10">
                    <span className="text-base">
                      {PERSONA_ICONS[persona.id] || "🤖"}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white/90">
                      {persona.name}
                    </h3>
                    <p className="text-[11px] text-white/40">
                      Budget: {formatBudget(persona.budget)}
                      {persona.category && ` · ${persona.category}`}
                    </p>
                  </div>
                </div>

                <button
                  id={`run-buyer-${persona.id}`}
                  onClick={() => handleRunBuyer(persona.id)}
                  disabled={isRunning || runningBuyer !== null}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    isRunning
                      ? "border border-violet-500/30 bg-violet-500/10 text-violet-300 cursor-wait"
                      : runningBuyer !== null
                        ? "border border-white/[0.06] bg-white/[0.02] text-white/20 cursor-not-allowed"
                        : "border border-violet-500/20 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 hover:border-violet-500/30"
                  }`}
                >
                  {isRunning ? (
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-3 w-3 animate-spin rounded-full border-[1.5px] border-violet-400 border-t-transparent" />
                      Running…
                    </span>
                  ) : (
                    "Run Buyer"
                  )}
                </button>
              </div>

              {/* Goal */}
              <p className="text-xs text-white/50 mb-1">
                <span className="text-white/30">Goal:</span> {persona.goal}
              </p>
              <p className="text-xs text-white/40 mb-3">
                <span className="text-white/30">Behavior:</span>{" "}
                {persona.behavior}
              </p>

              {/* Result / Timeline */}
              {result && (
                <div
                  className={`mt-3 rounded-lg border p-3 ${
                    result.outcome === "SUCCESS"
                      ? "border-emerald-500/20 bg-emerald-500/5"
                      : result.outcome === "EXPECTED_CONTENTION"
                        ? "border-amber-500/20 bg-amber-500/5"
                        : result.outcome === "NO_ELIGIBLE_INVENTORY" || result.outcome === "OUT_OF_BUDGET"
                          ? "border-zinc-500/20 bg-zinc-500/5"
                          : "border-red-500/20 bg-red-500/5"
                  }`}
                >
                  {/* Status header */}
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-[11px] font-semibold uppercase tracking-wider ${
                        result.outcome === "SUCCESS"
                          ? "text-emerald-400"
                          : result.outcome === "EXPECTED_CONTENTION"
                            ? "text-amber-400"
                            : result.outcome === "NO_ELIGIBLE_INVENTORY" || result.outcome === "OUT_OF_BUDGET"
                              ? "text-zinc-300"
                              : "text-red-400"
                      }`}
                    >
                      {result.outcome === "SUCCESS"
                        ? "✓ Purchase Complete"
                        : result.outcome === "EXPECTED_CONTENTION"
                          ? "⚡ Contention Loss (0 Oversell)"
                          : result.outcome === "NO_ELIGIBLE_INVENTORY"
                            ? "⏹ Out of Stock"
                            : result.outcome === "OUT_OF_BUDGET"
                              ? "⏹ Over Budget"
                              : "✕ System Error"}
                    </span>
                    <div className="flex items-center gap-2">
                      {result.provider && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-300 font-mono border border-violet-500/20">
                          {result.provider.toUpperCase()} {result.model ? `· ${result.model}` : ""}
                        </span>
                      )}
                      <span className="text-[10px] text-white/30">
                        {result.totalSteps} steps
                      </span>
                    </div>
                  </div>

                  {/* Fallback info banner */}
                  {result.fallbackUsed && (
                    <div className="mb-2.5 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-center gap-1.5">
                      <span>ℹ️</span>
                      <span>
                        {result.actions.find((a) => a.message.includes("fallback used"))?.message || "Deterministic fallback used"}
                      </span>
                    </div>
                  )}

                  {/* AI Decision Explanation Card */}
                  <div className="mb-3 rounded-lg border border-violet-500/25 bg-violet-500/10 p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-violet-300">
                        Decision Summary
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 font-medium border border-violet-500/30">
                        {result.decisionMode === "groq_ai"
                          ? "Groq AI Decision"
                          : result.decisionMode === "direct_deterministic"
                            ? "Direct Selection (0 LLM Calls)"
                            : "Deterministic Strategy"}
                      </span>
                    </div>
                    {result.selectedProduct && (
                      <div className="text-xs font-bold text-white mb-1">
                        Decision: <span className="text-emerald-300">{result.selectedProduct}</span>
                      </div>
                    )}
                    <div className="text-xs text-white/80">
                      <span className="font-semibold text-white/90 block text-[11px] mb-0.5">Why this product?</span>
                      <p className="leading-relaxed text-white/70 text-[11.5px]">
                        {result.selectionReason || result.error || "Selected according to buyer persona criteria and inventory availability."}
                      </p>
                    </div>
                  </div>

                  {/* Order info */}
                  {result.orderId && (
                    <div className="mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-white/50">Buyer:</span>
                        <span className="font-semibold text-white/90">
                          {result.buyerName}{" "}
                          <span className="font-normal text-white/40">({result.buyerEmail || `${persona.id}@agentstorm.ai`})</span>
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-white/50">Product:</span>
                        <span className="font-medium text-emerald-300">
                          {result.selectedProduct || "Item"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-white/50">Order ID:</span>
                        <span className="font-mono text-emerald-400">
                          {result.orderId}
                        </span>
                      </div>
                      {result.totalAmount !== undefined && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-white/50">Amount:</span>
                          <span className="font-semibold text-emerald-300">
                            {formatBudget(result.totalAmount)}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-emerald-500/20">
                        <span className="text-white/50">Order Status:</span>
                        <span className="font-mono text-[11px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">
                          {result.orderStatus || "PENDING"} (Stock Reserved)
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Action timeline */}
                  <div className="space-y-0 max-h-48 overflow-y-auto pr-1">
                    {result.actions.map((action, i) => (
                      <ActionLine key={i} action={action} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
