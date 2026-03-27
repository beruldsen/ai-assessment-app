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
  gap: number | null;
  absGap: number;
  selfComment: string | null;
  managerComment: string | null;
};

type Summary = {
  rows: ReportRow[];
  byGap: ReportRow[];
  byLowest: ReportRow[];
  byHighest: ReportRow[];
  overallSelf: number;
  overallManager: number;
  strongest?: ReportRow;
  largestGap?: ReportRow;
  topDevelopment?: ReportRow;
  developmentPriorities: ReportRow[];
  alignment: {
    strongAlignment: number;
    moderateMisalignment: number;
    significantMisalignment: number;
  };
};

function normalizeDisplayText(text: string) {
  return text
    .normalize("NFKC")
    .replace(/[\uFFF0-\uFFFF]/g, "")
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function radarPoint(idx: number, value: number, total: number, cx: number, cy: number, radius: number) {
  const angle = (Math.PI * 2 * idx) / total - Math.PI / 2;
  const r = (value / 5) * radius;
  return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r, angle };
}

function splitLabel(text: string, maxLineLength = 18, maxLines = 3) {
  const normalized = normalizeDisplayText(text).replace(/-/g, "- ");
  const words = normalized.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxLineLength) {
      current = next;
      continue;
    }
    if (current) {
      lines.push(current.replace(/\s+-\s+/g, "-").trim());
      current = word;
    } else {
      lines.push(word.slice(0, maxLineLength));
      current = word.slice(maxLineLength);
    }
    if (lines.length >= maxLines - 1) break;
  }

  if (current && lines.length < maxLines) lines.push(current.replace(/\s+-\s+/g, "-").trim());
  return lines.slice(0, maxLines);
}

function labelAnchor(angle: number) {
  const normalized = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const cos = Math.cos(normalized);
  if (cos > 0.35) return "start";
  if (cos < -0.35) return "end";
  return "middle";
}

function RadarChart({ rows }: { rows: ReportRow[] }) {
  if (!rows.length) return null;

  const size = 520;
  const cx = 260;
  const cy = 260;
  const radius = 150;
  const labelRadius = 182;

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
    <svg className="radar-svg" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {[1, 2, 3, 4, 5].map((lvl) => (
        <circle key={lvl} cx={cx} cy={cy} r={(lvl / 5) * radius} fill="none" stroke="#d1d5db" strokeWidth="1" />
      ))}
      {rows.map((r, i) => {
        const axis = radarPoint(i, 5, rows.length, cx, cy, radius);
        const label = radarPoint(i, 5, rows.length, cx, cy, labelRadius);
        const lines = splitLabel(r.dimension);
        const anchor = labelAnchor(label.angle);
        const startDy = lines.length > 1 ? `${-((lines.length - 1) * 0.55)}em` : "0.35em";
        return (
          <g key={r.dimension}>
            <line x1={cx} y1={cy} x2={axis.x} y2={axis.y} stroke="#d1d5db" strokeWidth="1" />
            <text x={label.x} y={label.y} textAnchor={anchor} fontSize="12" fontWeight="600" fill="#334155">
              {lines.map((line, idx) => (
                <tspan key={`${r.dimension}-${idx}`} x={label.x} dy={idx === 0 ? startDy : "1.15em"}>
                  {line}
                </tspan>
              ))}
            </text>
          </g>
        );
      })}
      <path d={toPath(selfVals)} fill="rgba(59,130,246,0.20)" stroke="#2563eb" strokeWidth="2.5" />
      <path d={toPath(managerVals)} fill="rgba(16,185,129,0.18)" stroke="#059669" strokeWidth="2.5" />
    </svg>
  );
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
  return `In ${normalizeDisplayText(dimension)}, agree one real customer-facing behaviour to practise weekly and review evidence together.`;
}

function PrintFriendlyReport({ data, summary }: { data: ApiResponse; summary: Summary }) {
  return (
    <div className="report-print-safe">
      <section className="report-sheet">
        <div className="report-sheet-header">
          <div>
            <div className="report-sheet-title">180° Capability Assessment Report</div>
            <div className="report-sheet-meta">{normalizeDisplayText(data.cycle.title)}</div>
          </div>
          <div className="report-sheet-meta report-sheet-meta-right">{normalizeDisplayText(data.cycle.participant_name)}</div>
        </div>

        <div className="report-sheet-section">
          <h2>Headline summary</h2>
          <div className="print-kpi-grid">
            <div className="print-kpi-box"><strong>Overall self</strong><span>{summary.overallSelf}/5</span></div>
            <div className="print-kpi-box"><strong>Overall manager</strong><span>{summary.overallManager}/5</span></div>
            <div className="print-kpi-box"><strong>Largest gap</strong><span>{normalizeDisplayText(summary.largestGap?.dimension ?? "-")}</span></div>
            <div className="print-kpi-box"><strong>Strongest capability</strong><span>{normalizeDisplayText(summary.strongest?.dimension ?? "-")}</span></div>
            <div className="print-kpi-box"><strong>Top development focus</strong><span>{normalizeDisplayText(summary.topDevelopment?.dimension ?? "-")}</span></div>
          </div>
        </div>
      </section>

      <section className="report-sheet">
        <div className="report-sheet-section">
          <h2>Capability overview</h2>
          <div className="print-radar-safe-grid">
            <div>
              <RadarChart rows={summary.rows} />
              <p className="meta">Blue = Self · Green = Manager</p>
            </div>
            <div className="print-legend-list">
              {summary.rows.map((r) => (
                <div key={`print-legend-${r.dimension}`} className="print-legend-item">
                  <strong>{normalizeDisplayText(r.dimension)}</strong>
                  <div className="meta">Self: {formatScore(r.selfAvg)} · Manager: {formatScore(r.managerAvg)} · Gap: {formatGap(r.gap)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="report-sheet">
        <div className="report-sheet-section">
          <h2>Capability breakdown</h2>
          <table className="print-table-safe">
            <thead>
              <tr>
                <th>Capability</th>
                <th>Self</th>
                <th>Manager</th>
                <th>Average</th>
                <th>Gap</th>
              </tr>
            </thead>
            <tbody>
              {summary.byGap.map((r) => (
                <tr key={`safe-table-${r.dimension}`}>
                  <td>{normalizeDisplayText(r.dimension)}</td>
                  <td>{formatScore(r.selfAvg)}</td>
                  <td>{formatScore(r.managerAvg)}</td>
                  <td>{formatScore(r.averageScore)}</td>
                  <td>{formatGap(r.gap)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="report-sheet">
        <div className="report-sheet-section">
          <h2>Key insights</h2>
          <div className="print-text-block">
            <strong>Strongest capability:</strong> {normalizeDisplayText(summary.strongest?.dimension ?? "-")}
            <div className="meta">Use this strength as a coaching anchor while raising weaker capabilities.</div>
          </div>
          <div className="print-text-block">
            <strong>Largest gap:</strong> {normalizeDisplayText(summary.largestGap?.dimension ?? "-")} ({formatGap(summary.largestGap?.gap ?? null)})
            <div className="meta">{recommendationForDimension(summary.largestGap?.dimension)}</div>
          </div>
          <div className="print-text-block">
            <strong>Top development focus:</strong> {normalizeDisplayText(summary.topDevelopment?.dimension ?? "-")}
            <div className="meta">{recommendationForDimension(summary.topDevelopment?.dimension)}</div>
          </div>
        </div>

        <div className="report-sheet-section">
          <h2>Top 3 development priorities</h2>
          {summary.developmentPriorities.map((r, idx) => (
            <div key={`safe-priority-${r.dimension}`} className="print-text-block">
              <strong>{idx + 1}. {normalizeDisplayText(r.dimension)}</strong>
              <div className="meta">Why it matters: {explanationForRow(r)}</div>
              <div className="meta">Suggested action: {recommendationForDimension(r.dimension)}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="report-sheet">
        <div className="report-sheet-section">
          <h2>Comments by capability</h2>
          {summary.rows.map((r) => (
            <div key={`safe-comments-${r.dimension}`} className="print-text-block">
              <strong>{normalizeDisplayText(r.dimension)}</strong>
              <div className="meta">Self: {formatScore(r.selfAvg)} · Manager: {formatScore(r.managerAvg)} · Gap: {formatGap(r.gap)}</div>
              <div className="meta"><strong>Self comment:</strong> {r.selfComment ?? "No self comment provided."}</div>
              <div className="meta"><strong>Manager comment:</strong> {r.managerComment ?? "No manager comment provided."}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function AssessmentReportPage() {
  const params = useParams<{ cycleId: string }>();
  const cycleId = String(params.cycleId ?? "");

  const [data, setData] = useState<ApiResponse | null>(null);
  const [status, setStatus] = useState("loading...");
  const [sortBy, setSortBy] = useState<"gap" | "lowest" | "highest">("gap");

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

  const summary = useMemo<Summary | null>(() => {
    if (!data || !isReportReady) return null;

    const byDimension = new Map<string, { self: number[]; manager: number[]; all: number[]; selfComments: string[]; managerComments: string[] }>();
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
      alignment: {
        strongAlignment: rows.filter((r) => r.absGap === 0).length,
        moderateMisalignment: rows.filter((r) => r.absGap > 0 && r.absGap < 2).length,
        significantMisalignment: rows.filter((r) => r.absGap >= 2).length,
      },
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
    const participant = (data?.cycle.participant_name || "Participant").trim().replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "Participant";
    const date = new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" }).replace(/\s+/g, "");
    document.title = `180_Assessment_${participant}_${date}.pdf`;
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

      <div className="print-hide-screen" style={{ display: isReportReady ? "block" : "none" }}>
        {!summary ? <section className="card"><p className="meta">{status || "No ratings yet."}</p></section> : (
          <>
            <section className="card" style={{ marginBottom: 12 }}>
              <h2 style={{ marginTop: 0 }}>Capability breakdown</h2>
              <div className="print-hide" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
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
                      <th style={{ textAlign: "left", borderBottom: "1px solid var(--border)", padding: "10px 12px" }}>Capability</th>
                      <th style={{ textAlign: "center", borderBottom: "1px solid var(--border)", padding: "10px 12px" }}>Self</th>
                      <th style={{ textAlign: "center", borderBottom: "1px solid var(--border)", padding: "10px 12px" }}>Manager</th>
                      <th style={{ textAlign: "center", borderBottom: "1px solid var(--border)", padding: "10px 12px" }}>Average</th>
                      <th style={{ textAlign: "center", borderBottom: "1px solid var(--border)", padding: "10px 12px" }}>Gap</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportRows.map((r) => (
                      <tr key={`rep-${r.dimension}`}>
                        <td style={{ borderBottom: "1px solid var(--border)", padding: "10px 12px" }}>{normalizeDisplayText(r.dimension)}</td>
                        <td style={{ borderBottom: "1px solid var(--border)", padding: "10px 12px", textAlign: "center" }}>{formatScore(r.selfAvg)}</td>
                        <td style={{ borderBottom: "1px solid var(--border)", padding: "10px 12px", textAlign: "center" }}>{formatScore(r.managerAvg)}</td>
                        <td style={{ borderBottom: "1px solid var(--border)", padding: "10px 12px", textAlign: "center" }}>{formatScore(r.averageScore)}</td>
                        <td style={{ borderBottom: "1px solid var(--border)", padding: "10px 12px", textAlign: "center" }}>{formatGap(r.gap)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>

      <div className="print-only-report" style={{ display: isReportReady && data && summary ? "block" : "none" }}>
        {data && summary ? <PrintFriendlyReport data={data} summary={summary} /> : null}
      </div>
    </main>
  );
}
