"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ASSESSMENT_180_CAPABILITIES } from "@/lib/assessment360";

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

function RadarChart({ rows }: { rows: Array<{ dimension: string; selfAvg: number | null; managerAvg: number | null }> }) {
  if (!rows.length) return null;
  const size = 280;
  const cx = 140;
  const cy = 140;
  const radius = 95;

  const point = (idx: number, value: number, total: number) => {
    const angle = (Math.PI * 2 * idx) / total - Math.PI / 2;
    const r = (value / 5) * radius;
    return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
  };

  const toPath = (vals: number[]) =>
    vals
      .map((v, i) => {
        const p = point(i, v, vals.length);
        return `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      })
      .join(" ") + " Z";

  const selfVals = rows.map((r) => r.selfAvg ?? 0);
  const managerVals = rows.map((r) => r.managerAvg ?? 0);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {[1, 2, 3, 4, 5].map((lvl) => (
        <circle key={lvl} cx={cx} cy={cy} r={(lvl / 5) * radius} fill="none" stroke="#2a2a2a" strokeWidth="1" />
      ))}
      {rows.map((r, i) => {
        const p = point(i, 5, rows.length);
        return <line key={r.dimension} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#2a2a2a" strokeWidth="1" />;
      })}
      <path d={toPath(selfVals)} fill="rgba(59,130,246,0.25)" stroke="#3b82f6" strokeWidth="2" />
      <path d={toPath(managerVals)} fill="rgba(16,185,129,0.2)" stroke="#10b981" strokeWidth="2" />
    </svg>
  );
}

export default function AssessmentReportPage() {
  const params = useParams<{ cycleId: string }>();
  const cycleId = String(params.cycleId ?? "");

  const [data, setData] = useState<ApiResponse | null>(null);
  const [status, setStatus] = useState("loading...");
  const [sortBy, setSortBy] = useState<"gap" | "self" | "manager" | "capability">("gap");

  async function authHeaders() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
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

  const advancedSummary = useMemo(() => {
    if (!data || !isReportReady) return null;

    const byDimension = new Map<string, { self: number[]; manager: number[]; all: number[] }>();
    for (const r of data.responses) {
      const bucket = byDimension.get(r.dimension) ?? { self: [], manager: [], all: [] };
      bucket.all.push(r.score);
      if (r.rater_type === "self") bucket.self.push(r.score);
      if (r.rater_type === "manager") bucket.manager.push(r.score);
      byDimension.set(r.dimension, bucket);
    }

    const avg = (arr: number[]) => (arr.length ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2)) : null);

    const rows = Array.from(byDimension.entries()).map(([dimension, vals]) => {
      const selfAvg = avg(vals.self);
      const managerAvg = avg(vals.manager);
      const overallAvg = avg(vals.all) ?? 0;
      const averageScore = selfAvg !== null && managerAvg !== null ? Number(((selfAvg + managerAvg) / 2).toFixed(2)) : null;
      const gap = selfAvg !== null && managerAvg !== null ? Number((selfAvg - managerAvg).toFixed(2)) : null;
      return { dimension, selfAvg, managerAvg, overallAvg, averageScore, gap, absGap: gap === null ? 0 : Math.abs(gap) };
    });

    const strengths = [...rows].sort((a, b) => b.overallAvg - a.overallAvg).slice(0, 3);
    const development = [...rows].sort((a, b) => a.overallAvg - b.overallAvg).slice(0, 3);
    const byGap = [...rows].sort((a, b) => b.absGap - a.absGap);

    return { rows, strengths, development, byGap };
  }, [data, isReportReady]);

  const reportRows = useMemo(() => {
    if (!advancedSummary) return [];
    const rows = [...advancedSummary.rows];
    if (sortBy === "gap") return rows.sort((a, b) => b.absGap - a.absGap);
    if (sortBy === "self") return rows.sort((a, b) => (b.selfAvg ?? 0) - (a.selfAvg ?? 0));
    if (sortBy === "manager") return rows.sort((a, b) => (b.managerAvg ?? 0) - (a.managerAvg ?? 0));
    return rows.sort((a, b) => a.dimension.localeCompare(b.dimension));
  }, [advancedSummary, sortBy]);

  const executiveSummary = useMemo(() => {
    if (!advancedSummary) return null;
    const overallSelf = advancedSummary.rows.reduce((acc, r) => acc + (r.selfAvg ?? 0), 0) / Math.max(1, advancedSummary.rows.length);
    const overallManager = advancedSummary.rows.reduce((acc, r) => acc + (r.managerAvg ?? 0), 0) / Math.max(1, advancedSummary.rows.length);
    const netGap = Number((overallSelf - overallManager).toFixed(2));
    const biggestGap = advancedSummary.byGap[0];
    const strongest = advancedSummary.strengths[0];
    return {
      overallSelf: Number(overallSelf.toFixed(2)),
      overallManager: Number(overallManager.toFixed(2)),
      netGap,
      biggestGap,
      strongest,
    };
  }, [advancedSummary]);

  function formatGap(gap: number | null) {
    if (gap === null) return "-";
    const inverted = Number((gap * -1).toFixed(2));
    return inverted > 0 ? `+${inverted}` : `${inverted}`;
  }

  return (
    <main className="page">
      <h1 className="title">180° Assessment Report</h1>
      <p className="subtitle">{data ? `${data.cycle.title} · ${data.cycle.participant_name}` : "Loading..."}</p>

      <section className="card surface-hero" style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <p className="meta" style={{ margin: 0 }}>Dedicated reporting page with capability trends and gaps.</p>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/assessment360/${cycleId}`} className="button ghost" style={{ textDecoration: "none" }}>Back to assessment</Link>
          <button className="button" onClick={() => window.print()}>Print / Save PDF</button>
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
        <section className="card" style={{ marginBottom: 12 }}>
          <h2 style={{ marginTop: 0 }}>Visual report</h2>
          {!advancedSummary || advancedSummary.rows.length === 0 ? <p className="meta">{status || "No ratings yet."}</p> : (
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <strong>Radar: Self vs Manager</strong>
                <RadarChart rows={advancedSummary.rows} />
                <p className="meta">Blue: self · Green: manager</p>
              </div>
              <div>
                <strong>Gap heatmap (largest misalignment first)</strong>
                <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                  {advancedSummary.byGap.map((r) => (
                    <div key={r.dimension} style={{ background: `rgba(239,68,68,${Math.min(0.1 + r.absGap / 5, 0.6)})`, padding: 8, borderRadius: 6 }}>
                      <div className="meta"><strong>{r.dimension}</strong></div>
                      <div className="meta">self {r.selfAvg ?? "-"} · manager {r.managerAvg ?? "-"} · gap (manager - self) {formatGap(r.gap)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="card" style={{ marginBottom: 12 }}>
          <h2 style={{ marginTop: 0 }}>Summary report</h2>
          {!advancedSummary || !executiveSummary ? (
            <p className="meta">No ratings yet.</p>
          ) : (
            <div className="grid" style={{ gap: 10 }}>
              <div className="kpiGrid">
                <div className="kpiCard primary"><strong>Overall self</strong><div className="meta">{executiveSummary.overallSelf}/5</div></div>
                <div className="kpiCard secondary"><strong>Overall manager</strong><div className="meta">{executiveSummary.overallManager}/5</div></div>
                <div className="kpiCard warning"><strong>Net gap (manager - self)</strong><div className="meta">{formatGap(executiveSummary.netGap)}</div></div>
                <div className="kpiCard warning"><strong>Biggest mismatch</strong><div className="meta">{executiveSummary.biggestGap?.dimension ?? "-"}</div></div>
                <div className="kpiCard success"><strong>Coverage</strong><div className="meta">{advancedSummary.rows.filter((r) => r.selfAvg !== null && r.managerAvg !== null).length}/{ASSESSMENT_180_CAPABILITIES.length} both rated</div></div>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <label className="meta">Sort by</label>
                <select className="select" value={sortBy} onChange={(e) => setSortBy(e.target.value as "gap" | "self" | "manager" | "capability") }>
                  <option value="gap">Gap</option>
                  <option value="self">Self score</option>
                  <option value="manager">Manager score</option>
                  <option value="capability">Capability</option>
                </select>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", borderBottom: "1px solid var(--border)", padding: "6px" }}>Capability</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid var(--border)", padding: "6px" }}>Self</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid var(--border)", padding: "6px" }}>Manager</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid var(--border)", padding: "6px" }}>Average Score</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid var(--border)", padding: "6px" }}>Gap (Manager - Self)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportRows.map((r) => (
                      <tr key={`rep-${r.dimension}`}>
                        <td style={{ borderBottom: "1px solid var(--border)", padding: "6px" }}>{r.dimension}</td>
                        <td style={{ borderBottom: "1px solid var(--border)", padding: "6px" }}>{r.selfAvg ?? "-"}</td>
                        <td style={{ borderBottom: "1px solid var(--border)", padding: "6px" }}>{r.managerAvg ?? "-"}</td>
                        <td style={{ borderBottom: "1px solid var(--border)", padding: "6px" }}>{r.averageScore ?? "-"}</td>
                        <td style={{ borderBottom: "1px solid var(--border)", padding: "6px" }}>{formatGap(r.gap)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
