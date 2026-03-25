"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type RaterType = "self" | "manager";

type ApiResponse = {
  cycle: {
    id: string;
    title: string;
    participant_name: string;
  };
  submissions: Array<{
    rater_type: RaterType;
    status: "draft" | "final_submitted";
  }>;
  responses: Array<{
    rater_type: RaterType;
    question_id: string;
    dimension: string;
    score: number;
    comment: string | null;
  }>;
};

type ReportRow = {
  dimension: string;
  selfAvg: number | null;
  managerAvg: number | null;
  overallAvg: number;
  averageScore: number | null;
  gap: number | null; // manager - self
  absGap: number;
  selfComment: string | null;
  managerComment: string | null;
};

function radarPoint(idx: number, value: number, total: number, cx: number, cy: number, radius: number) {
  const angle = (Math.PI * 2 * idx) / total - Math.PI / 2;
  const r = (value / 5) * radius;
  return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
}

function splitLabel(text: string, maxLineLength = 18, maxLines = 3) {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxLineLength) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    if (lines.length >= maxLines - 1) break;
  }

  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    lines[maxLines - 1] = `${lines[maxLines - 1].slice(0, Math.max(0, maxLineLength - 1))}…`;
  }
  return lines;
}

function RadarChart({ rows }: { rows: ReportRow[] }) {
  if (!rows.length) return null;

  const size = 420;
  const cx = 210;
  const cy = 210;
  const radius = 120;

  const toPath = (vals: number[]) =>
    vals
      .map((v, i) => {
        const p = radarPoint(i, v, vals.length, cx, cy, radius);
        return `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      })
      .join(" ") + " Z";

  const selfVals = rows.map((r) => r.selfAvg ?? 0);
  const managerVals = rows.map((r) => r.managerAvg ?? 0);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {[1, 2, 3, 4, 5].map((lvl) => (
        <circle key={lvl} cx={cx} cy={cy} r={(lvl / 5) * radius} fill="none" stroke="#d1d5db" strokeWidth="1" />
      ))}
      {rows.map((r, i) => {
        const p = radarPoint(i, 5, rows.length, cx, cy, radius);
        const label = radarPoint(i, 6.25, rows.length, cx, cy, radius);
        const lines = splitLabel(r.dimension);
        return (
          <g key={r.dimension}>
            <line x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#d1d5db" strokeWidth="1" />
            <text x={label.x} y={label.y} textAnchor="middle" fontSize="10" fill="#334155">
              {lines.map((line, idx) => (
                <tspan key={`${r.dimension}-${idx}`} x={label.x} dy={idx === 0 ? 0 : 11}>
                  {line}
                </tspan>
              ))}
            </text>
          </g>
        );
      })}

      <path d={toPath(selfVals)} fill="rgba(59,130,246,0.20)" stroke="#2563eb" strokeWidth="2" />
      <path d={toPath(managerVals)} fill="rgba(16,185,129,0.18)" stroke="#059669" strokeWidth="2" />
    </svg>
  );
}

function gapBackground(absGap: number) {
  if (absGap >= 2) return "rgba(239,68,68,0.16)";
  if (absGap >= 1) return "rgba(245,158,11,0.14)";
  return "rgba(16,185,129,0.12)";
}

function formatScore(val: number | null) {
  return val === null ? "-" : val.toFixed(2);
}

function formatGap(gap: number | null) {
  if (gap === null) return "-";
  return gap > 0 ? `+${gap.toFixed(2)}` : gap.toFixed(2);
}

function explanationForRow(row?: ReportRow) {
  if (!row) return "Not enough data yet.";
  if (row.gap === null) return "One side has not submitted enough data to compare yet.";
  if (row.gap >= 1) return "Manager perceives stronger performance than self-rating. Validate confidence and consistency.";
  if (row.gap <= -1) return "Self-rating is higher than manager view. Align on observable examples and expectations.";
  return "Self and manager are closely aligned. Maintain consistency and raise overall level.";
}

function recommendationForDimension(dimension?: string) {
  if (!dimension) return "Set one concrete behaviour goal for the next 30 days and review progress weekly.";
  return `In ${dimension}, agree one real customer-facing behaviour to practise weekly and review evidence together.`;
}

export default function AssessmentReportPage() {
  const params = useParams<{ cycleId: string }>();
  const cycleId = String(params.cycleId ?? "");

  const [data, setData] = useState<ApiResponse | null>(null);
  const [status, setStatus] = useState("loading...");
  const [sortBy, setSortBy] = useState<"gap" | "lowest" | "highest">("gap");

  const reportDate = useMemo(
    () => new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    [],
  );

  async function authHeaders(): Promise<Record<string, string>> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }

  async function load() {
    setStatus("loading...");
    const res = await fetch(`/api/assessment360/cycles/${cycleId}`, { headers: await authHeaders() });
    const json = await res.json();
    if (!res.ok) {
      setStatus(`error: ${json.error ?? "failed"}`);
      return;
    }

    setData(json as ApiResponse);
    setStatus("");
  }

  useEffect(() => {
    if (!cycleId) return;
    load();
  }, [cycleId]);

  const isReportReady = useMemo(() => {
    if (!data?.submissions?.length) return false;
    const selfFinal = data.submissions.find((s) => s.rater_type === "self")?.status === "final_submitted";
    const managerFinal = data.submissions.find((s) => s.rater_type === "manager")?.status === "final_submitted";
    return selfFinal && managerFinal;
  }, [data]);

  const summary = useMemo(() => {
    if (!data || !isReportReady) return null;

    const byDimension = new Map<string, {
      self: number[];
      manager: number[];
      all: number[];
      selfComments: string[];
      managerComments: string[];
    }>();

    for (const r of data.responses) {
      const bucket = byDimension.get(r.dimension) ?? { self: [], manager: [], all: [], selfComments: [], managerComments: [] };
      bucket.all.push(r.score);
      if (r.rater_type === "self") {
        bucket.self.push(r.score);
        if (r.comment?.trim()) bucket.selfComments.push(r.comment.trim());
      }
      if (r.rater_type === "manager") {
        bucket.manager.push(r.score);
        if (r.comment?.trim()) bucket.managerComments.push(r.comment.trim());
      }
      byDimension.set(r.dimension, bucket);
    }

    const avg = (arr: number[]) => (arr.length ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2)) : null);

    const rows: ReportRow[] = Array.from(byDimension.entries()).map(([dimension, vals]) => {
      const selfAvg = avg(vals.self);
      const managerAvg = avg(vals.manager);
      const overallAvg = avg(vals.all) ?? 0;
      const averageScore = selfAvg !== null && managerAvg !== null ? Number(((selfAvg + managerAvg) / 2).toFixed(2)) : null;
      const gap = selfAvg !== null && managerAvg !== null ? Number((managerAvg - selfAvg).toFixed(2)) : null;
      return {
        dimension,
        selfAvg,
        managerAvg,
        overallAvg,
        averageScore,
        gap,
        absGap: gap === null ? 0 : Math.abs(gap),
        selfComment: vals.selfComments[0] ?? null,
        managerComment: vals.managerComments[0] ?? null,
      };
    });

    const byGap = [...rows].sort((a, b) => b.absGap - a.absGap);
    const byLowest = [...rows].sort((a, b) => (a.averageScore ?? 0) - (b.averageScore ?? 0));
    const byHighest = [...rows].sort((a, b) => (b.averageScore ?? 0) - (a.averageScore ?? 0));

    const overallSelf = rows.reduce((acc, r) => acc + (r.selfAvg ?? 0), 0) / Math.max(1, rows.length);
    const overallManager = rows.reduce((acc, r) => acc + (r.managerAvg ?? 0), 0) / Math.max(1, rows.length);

    const strongAlignment = rows.filter((r) => r.absGap === 0).length;
    const moderateMisalignment = rows.filter((r) => r.absGap > 0 && r.absGap < 2).length;
    const significantMisalignment = rows.filter((r) => r.absGap >= 2).length;

    return {
      rows,
      byGap,
      byLowest,
      byHighest,
      overallSelf: Number(overallSelf.toFixed(2)),
      overallManager: Number(overallManager.toFixed(2)),
      strongest: byHighest[0],
      largestGap: byGap[0],
      topDevelopment: byLowest[0],
      developmentPriorities: byLowest.slice(0, 3),
      alignment: { strongAlignment, moderateMisalignment, significantMisalignment },
    };
  }, [data, isReportReady]);

  const reportRows = useMemo(() => {
    if (!summary) return [];
    if (sortBy === "lowest") return summary.byLowest;
    if (sortBy === "highest") return summary.byHighest;
    return summary.byGap;
  }, [summary, sortBy]);

  function handlePrint() {
    const originalTitle = document.title;
    const participant = (data?.cycle.participant_name || "Participant").replace(/\s+/g, "_");
    const date = new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" }).replace(/\s+/g, "");
    document.title = `180_Assessment_${participant}_${date}`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 250);
  }

  return (
    <main className="page">
      <h1 className="title">180° Assessment Report</h1>
      <p className="subtitle">{data ? `${data.cycle.title} · ${data.cycle.participant_name}` : "Loading..."}</p>

      <section className="card surface-hero" style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <p className="meta" style={{ margin: 0 }}>Development-focused report (scale: 1-5, 5 = consistently demonstrates the capability).</p>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/assessment360/${cycleId}`} className="button ghost" style={{ textDecoration: "none" }}>Back to assessment</Link>
          <button className="button" onClick={handlePrint}>Print / Save PDF</button>
        </div>
      </section>

      {!isReportReady ? (
        <section className="card" style={{ marginBottom: 12 }}>
          <h2 style={{ marginTop: 0 }}>Report not ready yet</h2>
          <p className="meta">The report is generated only after both self and manager complete their assessments.</p>
          <p className="meta">Current status: {data?.submissions?.map((s) => `${s.rater_type}: ${s.status}`).join(" · ") || "waiting for submissions"}</p>
          <Link href={`/assessment360/${cycleId}`} className="button ghost" style={{ textDecoration: "none" }}>Back to assessment</Link>
        </section>
      ) : null}

      <div className="print-report" style={{ display: isReportReady ? "block" : "none" }}>
        <header className="report-print-header" aria-hidden>
          <div className="report-print-title">180° Capability Assessment Report</div>
          <div className="report-print-meta">{data?.cycle.participant_name ?? "Participant"} · {reportDate}</div>
        </header>
        <footer className="report-print-footer" aria-hidden />

        {!summary ? <section className="card"><p className="meta">{status || "No ratings yet."}</p></section> : (
          <>
            {/* 1) Headline summary */}
            <section className="card" style={{ marginBottom: 12 }}>
              <h2 style={{ marginTop: 0 }}>Headline summary</h2>
              <div className="kpiGrid">
                <div className="kpiCard primary"><strong>Overall self</strong><div className="meta">{summary.overallSelf}/5</div></div>
                <div className="kpiCard secondary"><strong>Overall manager</strong><div className="meta">{summary.overallManager}/5</div></div>
                <div className="kpiCard warning"><strong>Largest gap</strong><div className="meta">{summary.largestGap?.dimension ?? "-"}</div></div>
                <div className="kpiCard success"><strong>Strongest capability</strong><div className="meta">{summary.strongest?.dimension ?? "-"}</div></div>
                <div className="kpiCard warning"><strong>Top development focus</strong><div className="meta">{summary.topDevelopment?.dimension ?? "-"}</div></div>
              </div>
            </section>

            {/* 2) Radar chart */}
            <section className="card" style={{ marginBottom: 12 }}>
              <h2 style={{ marginTop: 0 }}>Capability overview (radar)</h2>
              <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <RadarChart rows={summary.rows} />
                  <p className="meta" style={{ marginTop: 4 }}>
                    Blue = Self · Green = Manager
                  </p>
                </div>
                <div style={{ display: "grid", gap: 8, alignContent: "start" }}>
                  <strong>Exact scores by capability</strong>
                  {summary.rows.map((r) => (
                    <div key={`legend-${r.dimension}`} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 8 }}>
                      <div style={{ fontWeight: 600 }}>{r.dimension}</div>
                      <div className="meta">Self: {formatScore(r.selfAvg)} · Manager: {formatScore(r.managerAvg)} · Gap: {formatGap(r.gap)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* 3) Key insights */}
            <section className="card" style={{ marginBottom: 12 }}>
              <h2 style={{ marginTop: 0 }}>Key insights</h2>
              <div className="grid" style={{ gap: 10 }}>
                <div className="card" style={{ background: "#f8fafc", borderColor: "#cbd5e1" }}>
                  <strong>Strongest capability: {summary.strongest?.dimension ?? "-"}</strong>
                  <p className="meta" style={{ margin: "6px 0 0 0" }}>What this means: This is a reliable strength to keep leveraging in high-value conversations.</p>
                  <p className="meta" style={{ margin: "6px 0 0 0" }}>Recommendation: Use this strength as a coaching anchor while raising weaker capabilities.</p>
                </div>
                <div className="card" style={{ background: "#f8fafc", borderColor: "#cbd5e1" }}>
                  <strong>Largest gap: {summary.largestGap?.dimension ?? "-"} ({formatGap(summary.largestGap?.gap ?? null)})</strong>
                  <p className="meta" style={{ margin: "6px 0 0 0" }}>What this means: There is a perception mismatch that can block targeted development if left unresolved.</p>
                  <p className="meta" style={{ margin: "6px 0 0 0" }}>Recommendation: {recommendationForDimension(summary.largestGap?.dimension)}</p>
                </div>
                <div className="card" style={{ background: "#f8fafc", borderColor: "#cbd5e1" }}>
                  <strong>Top development focus: {summary.topDevelopment?.dimension ?? "-"}</strong>
                  <p className="meta" style={{ margin: "6px 0 0 0" }}>What this means: This area currently has the greatest impact potential for improved performance outcomes.</p>
                  <p className="meta" style={{ margin: "6px 0 0 0" }}>Recommendation: {recommendationForDimension(summary.topDevelopment?.dimension)}</p>
                </div>
              </div>
            </section>

            {/* 4) Capability table */}
            <section className="card" style={{ marginBottom: 12 }}>
              <h2 style={{ marginTop: 0 }}>Capability breakdown</h2>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                <label className="meta">Sort by</label>
                <select className="select" value={sortBy} onChange={(e) => setSortBy(e.target.value as "gap" | "lowest" | "highest") }>
                  <option value="gap">Gap (default)</option>
                  <option value="lowest">Lowest score</option>
                  <option value="highest">Highest score</option>
                </select>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", borderBottom: "1px solid var(--border)", padding: "6px" }}>Capability</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid var(--border)", padding: "6px" }}>Self</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid var(--border)", padding: "6px" }}>Manager</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid var(--border)", padding: "6px" }}>Average</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid var(--border)", padding: "6px" }}>Gap (Manager - Self)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportRows.map((r) => (
                      <tr key={`rep-${r.dimension}`} style={{ background: gapBackground(r.absGap) }}>
                        <td style={{ borderBottom: "1px solid var(--border)", padding: "6px" }}>{r.dimension}</td>
                        <td style={{ borderBottom: "1px solid var(--border)", padding: "6px" }}>{formatScore(r.selfAvg)}</td>
                        <td style={{ borderBottom: "1px solid var(--border)", padding: "6px" }}>{formatScore(r.managerAvg)}</td>
                        <td style={{ borderBottom: "1px solid var(--border)", padding: "6px" }}>{formatScore(r.averageScore)}</td>
                        <td style={{ borderBottom: "1px solid var(--border)", padding: "6px", fontWeight: 600 }}>{formatGap(r.gap)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* 5) Comments by capability */}
            <section className="card" style={{ marginBottom: 12 }}>
              <h2 style={{ marginTop: 0 }}>Comments by capability</h2>
              <div style={{ display: "grid", gap: 10 }}>
                {summary.rows.map((r) => (
                  <div key={`comments-${r.dimension}`} className="card" style={{ background: "#f8fafc", borderColor: "#cbd5e1" }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>{r.dimension}</div>
                    <div className="meta" style={{ marginBottom: 8 }}>
                      Self: {formatScore(r.selfAvg)} | Manager: {formatScore(r.managerAvg)} | Gap: {formatGap(r.gap)}
                    </div>
                    <div className="meta" style={{ marginBottom: 4 }}><strong>Self comment:</strong> {r.selfComment ?? "No self comment provided."}</div>
                    <div className="meta"><strong>Manager comment:</strong> {r.managerComment ?? "No manager comment provided."}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* 6) Development priorities + alignment */}
            <section className="card" style={{ marginBottom: 12 }}>
              <h2 style={{ marginTop: 0 }}>Top 3 development priorities</h2>
              <div style={{ display: "grid", gap: 10 }}>
                {summary.developmentPriorities.map((r, idx) => (
                  <div key={`priority-${r.dimension}`} className="card" style={{ background: "#f8fafc", borderColor: "#cbd5e1" }}>
                    <strong>{idx + 1}. {r.dimension}</strong>
                    <p className="meta" style={{ margin: "6px 0 0 0" }}>Why it matters: {explanationForRow(r)}</p>
                    <p className="meta" style={{ margin: "6px 0 0 0" }}>Suggested action: {recommendationForDimension(r.dimension)}</p>
                  </div>
                ))}
              </div>

              <h3 style={{ marginTop: 16, marginBottom: 8 }}>Alignment view</h3>
              <div className="kpiGrid">
                <div className="kpiCard success"><strong>Strong alignment (gap = 0)</strong><div className="meta">{summary.alignment.strongAlignment}</div></div>
                <div className="kpiCard warning"><strong>Moderate misalignment (±1)</strong><div className="meta">{summary.alignment.moderateMisalignment}</div></div>
                <div className="kpiCard warning"><strong>Significant misalignment (≥2)</strong><div className="meta">{summary.alignment.significantMisalignment}</div></div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
