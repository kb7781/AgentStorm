"use client";

export interface CategoryScore {
  name: string;
  score: number;
  status: "PASS" | "WARN" | "FAIL";
  description: string;
  metrics: Record<string, number | string | boolean>;
}

export interface Finding {
  type: "positive" | "warning" | "negative";
  category: "Inventory" | "Payment" | "Order" | "AI Buyer";
  message: string;
  evidence: string;
}

export interface Recommendation {
  priority: "HIGH" | "MEDIUM" | "LOW";
  area: string;
  title: string;
  description: string;
}

export interface ReliabilityReport {
  simulationId: string;
  scenarioId: string;
  scenarioName: string;
  timestamp: string;
  overallScore: number;
  scoreFormula: string;
  verdict: "EXCELLENT" | "STABLE" | "DEGRADED" | "CRITICAL";
  categories: {
    inventorySafety: CategoryScore;
    paymentReliability: CategoryScore;
    orderConsistency: CategoryScore;
    buyerSuccess: CategoryScore;
  };
  findings: Finding[];
  recommendations: Recommendation[];
  eventSummary: {
    ordersCreated: number;
    paymentsCaptured: number;
    paymentsFailed: number;
    stockRestorations: number;
    stockConflicts: number;
    oversellEvents: number;
    totalSimulationEvents: number;
  };
  criticalIssues: string[];
  executiveSummary: string;
}

interface ReportViewProps {
  report: ReliabilityReport;
}

export default function ReportView({ report }: ReportViewProps) {
  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-emerald-400";
    if (score >= 75) return "text-amber-400";
    return "text-red-400";
  };

  const getScoreBg = (score: number) => {
    if (score >= 90) return "bg-emerald-500/10 border-emerald-500/20";
    if (score >= 75) return "bg-amber-500/10 border-amber-500/20";
    return "bg-red-500/10 border-red-500/20";
  };

  const getStatusBadge = (status: "PASS" | "WARN" | "FAIL") => {
    if (status === "PASS") return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
    if (status === "WARN") return "bg-amber-500/20 text-amber-300 border-amber-500/30";
    return "bg-red-500/20 text-red-300 border-red-500/30";
  };

  const categoryList = [
    report.categories.inventorySafety,
    report.categories.paymentReliability,
    report.categories.orderConsistency,
    report.categories.buyerSuccess,
  ];

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* 1. Header & Hero Score Card */}
      <div className="rounded-2xl border border-white/[0.1] bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-6 sm:p-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xl">📊</span>
              <span className="text-xs font-bold uppercase tracking-widest text-violet-400">
                Deterministic Reliability Audit
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white/95">
              AgentStorm Reliability Report
            </h3>
            <p className="text-xs text-white/50">
              Scenario: <span className="font-semibold text-white/80">{report.scenarioName}</span> · ID:{" "}
              <span className="font-mono text-white/40">{report.simulationId}</span>
            </p>
          </div>

          {/* Hero Score Badge */}
          <div className={`flex items-center gap-5 rounded-xl border p-4 sm:px-6 ${getScoreBg(report.overallScore)}`}>
            <div className="text-right">
              <span className="text-[11px] font-bold uppercase tracking-wider text-white/50 block">
                Reliability Score
              </span>
              <span className="text-[10px] font-mono text-white/30 block mt-0.5">
                Formula: Avg(4 Categories)
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className={`text-4xl sm:text-5xl font-black tracking-tight ${getScoreColor(report.overallScore)}`}>
                {report.overallScore}
              </span>
              <span className="text-base font-bold text-white/30">/100</span>
            </div>
          </div>
        </div>

        {/* Executive Summary */}
        <div className="mt-6 rounded-xl bg-black/40 border border-white/[0.06] p-4 text-xs text-white/70 leading-relaxed">
          <span className="font-semibold text-violet-300">Executive Summary: </span>
          {report.executiveSummary}
        </div>
      </div>

      {/* 2. Four Deterministic Category Score Cards */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-3">
          Reliability Dimensions (Deterministic Audit)
        </h4>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categoryList.map((cat, idx) => (
            <div
              key={idx}
              className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 hover:border-white/[0.14] transition-colors"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-white/90">{cat.name}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getStatusBadge(cat.status)}`}>
                    {cat.status}
                  </span>
                </div>

                <div className="flex items-baseline gap-1 mb-2">
                  <span className={`text-2xl font-black ${getScoreColor(cat.score)}`}>
                    {cat.score}%
                  </span>
                </div>

                <p className="text-[11px] text-white/40 leading-relaxed mb-3">
                  {cat.description}
                </p>
              </div>

              {/* Mini progress bar */}
              <div className="w-full bg-white/[0.05] rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    cat.score >= 90 ? "bg-emerald-400" : cat.score >= 75 ? "bg-amber-400" : "bg-red-400"
                  }`}
                  style={{ width: `${cat.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Key Findings & Actionable Recommendations */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Key Findings */}
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-base">🔍</span>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white/80">
              Evidence-Based Findings
            </h4>
          </div>

          <div className="space-y-2.5">
            {report.findings.map((f, i) => (
              <div
                key={i}
                className="rounded-lg border border-white/[0.06] bg-black/20 p-3 space-y-1 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span>
                    {f.type === "positive" ? "✅" : f.type === "warning" ? "⚠️" : "❌"}
                  </span>
                  <span className="font-semibold text-white/90">{f.message}</span>
                  <span className="ml-auto text-[10px] font-mono text-white/30 px-1.5 py-0.5 rounded bg-white/[0.04]">
                    {f.category}
                  </span>
                </div>
                <p className="text-white/50 text-[11px] pl-6">{f.evidence}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Actionable Recommendations */}
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-base">💡</span>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white/80">
              Engineering Recommendations
            </h4>
          </div>

          <div className="space-y-2.5">
            {report.recommendations.map((r, i) => (
              <div
                key={i}
                className="rounded-lg border border-white/[0.06] bg-black/20 p-3 space-y-1 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white/90">{r.title}</span>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      r.priority === "HIGH"
                        ? "bg-red-500/20 text-red-300"
                        : r.priority === "MEDIUM"
                          ? "bg-amber-500/20 text-amber-300"
                          : "bg-blue-500/20 text-blue-300"
                    }`}
                  >
                    {r.priority} PRIORITY
                  </span>
                </div>
                <p className="text-white/50 text-[11px] leading-relaxed">{r.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Event Evidence Summary & Critical Issues Ledger */}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">📜</span>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white/80">
              Simulation Event Ledger Summary
            </h4>
          </div>
          <span className="text-[11px] font-mono text-white/30">
            {report.eventSummary.totalSimulationEvents} total atomic events recorded
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6 text-center text-xs">
          <div className="rounded-lg border border-white/[0.06] bg-black/30 p-2.5">
            <span className="text-[10px] text-white/40 block">Orders Created</span>
            <span className="text-base font-bold text-white/90 mt-0.5 block">
              {report.eventSummary.ordersCreated}
            </span>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-black/30 p-2.5">
            <span className="text-[10px] text-white/40 block">Payments Captured</span>
            <span className="text-base font-bold text-emerald-400 mt-0.5 block">
              {report.eventSummary.paymentsCaptured}
            </span>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-black/30 p-2.5">
            <span className="text-[10px] text-white/40 block">Payments Failed</span>
            <span className="text-base font-bold text-amber-400 mt-0.5 block">
              {report.eventSummary.paymentsFailed}
            </span>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-black/30 p-2.5">
            <span className="text-[10px] text-white/40 block">Stock Restorations</span>
            <span className="text-base font-bold text-blue-400 mt-0.5 block">
              {report.eventSummary.stockRestorations}
            </span>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-black/30 p-2.5">
            <span className="text-[10px] text-white/40 block">Stock Conflicts</span>
            <span className="text-base font-bold text-white/70 mt-0.5 block">
              {report.eventSummary.stockConflicts}
            </span>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-black/30 p-2.5">
            <span className="text-[10px] text-white/40 block">Oversell Events</span>
            <span className={`text-base font-bold mt-0.5 block ${report.eventSummary.oversellEvents === 0 ? "text-emerald-400" : "text-red-400"}`}>
              {report.eventSummary.oversellEvents}
            </span>
          </div>
        </div>

        {/* Critical Issues Check */}
        <div className="pt-2 border-t border-white/[0.06]">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/50">Critical Integrity Issues:</span>
            {report.criticalIssues.length === 0 ? (
              <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                <span>🛡️</span> Zero Anomalies Detected
              </span>
            ) : (
              <span className="font-semibold text-red-400">
                {report.criticalIssues.length} Anomaly Flagged
              </span>
            )}
          </div>
          {report.criticalIssues.length > 0 && (
            <div className="mt-2 space-y-1">
              {report.criticalIssues.map((iss, i) => (
                <p key={i} className="text-red-400/80 text-[11px]">
                  • {iss}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
