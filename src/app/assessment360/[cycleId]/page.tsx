"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ASSESSMENT_180_CAPABILITIES, ASSESSMENT_360_QUESTIONS, type RaterType } from "@/lib/assessment360";

type SubmissionState = {
  rater_type: RaterType;
  status: "draft" | "final_submitted";
  submitted_at: string | null;
  version: number;
};

type ApiResponse = {
  viewerRole: "self" | "manager" | "admin" | null;
  cycle: {
    id: string;
    title: string;
    participant_name: string;
    status: string;
    created_at: string;
  };
  responses: Array<{
    rater_type: RaterType;
    question_id: string;
    dimension: string;
    question_text: string;
    score: number;
    comment: string | null;
  }>;
  submissions: SubmissionState[];
  actionPlan: {
    strengths: string | null;
    priorities: string | null;
    plan_30: string | null;
    plan_60: string | null;
    plan_90: string | null;
    updated_at: string;
  } | null;
  summary: {
    raterAverages: Array<{ raterType: string; avgScore: number }>;
    dimensionAverages: Array<{ dimension: string; avgScore: number }>;
  };
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

export default function Assessment360CyclePage() {
  const params = useParams<{ cycleId: string }>();
  const cycleId = String(params.cycleId ?? "");

  const [tab, setTab] = useState<RaterType>("self");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [status, setStatus] = useState("loading...");
  const [saving, setSaving] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);

  const [scores, setScores] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [strengthsText, setStrengthsText] = useState("");
  const [prioritiesText, setPrioritiesText] = useState("");
  const [plan30, setPlan30] = useState("");
  const [plan60, setPlan60] = useState("");
  const [plan90, setPlan90] = useState("");
  const [sortBy, setSortBy] = useState<"gap" | "self" | "manager" | "capability">("gap");

  async function authHeaders() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function load() {
    setStatus("loading...");
    const res = await fetch(`/api/assessment360/cycles/${cycleId}`, { headers: await authHeaders() });
    const json = (await res.json()) as ApiResponse | { error: string };
    if (!res.ok) {
      const message = "error" in json ? json.error : "failed";
      setStatus(`error: ${message}`);
      return;
    }
    const payload = json as ApiResponse;
    setData(payload);
    setStrengthsText(payload.actionPlan?.strengths ?? "");
    setPrioritiesText(payload.actionPlan?.priorities ?? "");
    setPlan30(payload.actionPlan?.plan_30 ?? "");
    setPlan60(payload.actionPlan?.plan_60 ?? "");
    setPlan90(payload.actionPlan?.plan_90 ?? "");
    setStatus("");
  }

  useEffect(() => {
    if (!cycleId) return;
    load();
  }, [cycleId]);

  useEffect(() => {
    if (!data) return;
    const filtered = data.responses.filter((r) => r.rater_type === tab);
    const nextScores: Record<string, number> = {};
    const nextComments: Record<string, string> = {};
    for (const r of filtered) {
      nextScores[r.question_id] = r.score;
      nextComments[r.question_id] = r.comment ?? "";
    }
    setScores(nextScores);
    setComments(nextComments);
  }, [tab, data]);

  const currentSubmission = useMemo(
    () => data?.submissions.find((s) => s.rater_type === tab) ?? null,
    [data, tab],
  );
  const isFinalized = currentSubmission?.status === "final_submitted";
  const completion = useMemo(() => {
    const done = ASSESSMENT_360_QUESTIONS.filter((q) => Number(scores[q.id]) >= 1 && Number(scores[q.id]) <= 5).length;
    return { done, total: ASSESSMENT_360_QUESTIONS.length };
  }, [scores]);

  const advancedSummary = useMemo(() => {
    if (!data) return null;

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
      const gap = selfAvg !== null && managerAvg !== null ? Number((selfAvg - managerAvg).toFixed(2)) : null;
      return { dimension, selfAvg, managerAvg, overallAvg, gap, absGap: gap === null ? 0 : Math.abs(gap) };
    });

    const strengths = [...rows].sort((a, b) => b.overallAvg - a.overallAvg).slice(0, 3);
    const development = [...rows].sort((a, b) => a.overallAvg - b.overallAvg).slice(0, 3);
    const byGap = [...rows].sort((a, b) => b.absGap - a.absGap);

    return { rows, strengths, development, byGap };
  }, [data]);

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

  const commentsByDimension = useMemo(() => {
    if (!data) return [] as Array<{ dimension: string; self: string[]; manager: string[] }>;
    const map = new Map<string, { self: string[]; manager: string[] }>();
    for (const r of data.responses) {
      if (!r.comment?.trim()) continue;
      const bucket = map.get(r.dimension) ?? { self: [], manager: [] };
      if (r.rater_type === "self") bucket.self.push(r.comment.trim());
      if (r.rater_type === "manager") bucket.manager.push(r.comment.trim());
      map.set(r.dimension, bucket);
    }
    return Array.from(map.entries()).map(([dimension, v]) => ({ dimension, self: v.self, manager: v.manager }));
  }, [data]);

  async function saveRatings(mode: "draft" | "final") {
    const answers = ASSESSMENT_360_QUESTIONS
      .map((q) => ({ questionId: q.id, score: Number(scores[q.id]), comment: comments[q.id] ?? "" }))
      .filter((a) => Number.isFinite(a.score) && a.score >= 1 && a.score <= 5);

    if (answers.length === 0) return setStatus("Please score at least one question before saving.");

    setSaving(true);
    const res = await fetch(`/api/assessment360/cycles/${cycleId}/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ raterType: tab, answers, mode }),
    });

    const json = await res.json();
    setSaving(false);
    if (!res.ok) return setStatus(`error: ${json.error ?? "failed"}`);
    await load();
    setStatus(mode === "final" ? `Final submitted for ${tab}.` : `Saved draft for ${tab}.`);
  }

  async function reopenFinal() {
    const answers = ASSESSMENT_360_QUESTIONS
      .map((q) => ({ questionId: q.id, score: Number(scores[q.id]), comment: comments[q.id] ?? "" }))
      .filter((a) => Number.isFinite(a.score) && a.score >= 1 && a.score <= 5);

    const res = await fetch(`/api/assessment360/cycles/${cycleId}/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ raterType: tab, answers, mode: "draft", forceEditAfterFinal: true }),
    });

    const json = await res.json();
    if (!res.ok) return setStatus(`error: ${json.error ?? "failed"}`);
    await load();
    setStatus(`${tab} reopened to draft.`);
  }

  async function saveActionPlan() {
    setSavingPlan(true);
    const res = await fetch(`/api/assessment360/cycles/${cycleId}/action-plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ strengths: strengthsText, priorities: prioritiesText, plan30, plan60, plan90 }),
    });
    const json = await res.json();
    setSavingPlan(false);
    if (!res.ok) return setStatus(`error: ${json.error ?? "failed to save action plan"}`);
    setStatus("Saved development action plan.");
    await load();
  }

  return (
    <main className="page">
      <h1 className="title">Future SE 180° Assessment Cycle</h1>
      <p className="subtitle">{data ? `${data.cycle.title} · ${data.cycle.participant_name}` : "Loading..."}</p>

      <section className="card" style={{ marginBottom: 12 }}>
        <div className="progress" style={{ marginBottom: 10 }}>
          <button className={`step ${tab === "self" ? "active" : ""}`} onClick={() => setTab("self")}>Self</button>
          <button className={`step ${tab === "manager" ? "active" : ""}`} onClick={() => setTab("manager")}>Manager</button>
        </div>
        <p className="meta">Purpose: development-first feedback, not punitive scoring.</p>
        <p className="meta">Rate observed behavior from this cycle period and use comments as evidence.</p>
        <p className="meta">Your role: {data?.viewerRole ?? "unknown"}</p>
        <p className="meta">{tab.toUpperCase()} completion: {completion.done}/{completion.total} · status: {currentSubmission?.status ?? "not started"}</p>
      </section>

      <section className="card grid" style={{ marginBottom: 12 }}>
        {ASSESSMENT_180_CAPABILITIES.map((capability, idx) => {
          const q = ASSESSMENT_360_QUESTIONS.find((x) => x.id === capability.id);
          if (!q) return null;
          return (
            <div key={capability.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
              <h3 style={{ margin: "0 0 8px" }}>{idx + 1}. {capability.capability}</h3>
              <ul className="meta" style={{ marginTop: 0, marginBottom: 10, paddingLeft: 18 }}>
                {capability.behaviors.map((b, i) => <li key={`${capability.id}-${i}`} style={{ marginBottom: 4 }}>{b}</li>)}
              </ul>
              <div style={{ display: "grid", gap: 8 }}>
                <select className="select" value={scores[q.id] ?? ""} disabled={isFinalized} onChange={(e) => setScores((s) => ({ ...s, [q.id]: Number(e.target.value) }))}>
                  <option value="">Score (1-5)</option>
                  <option value="1">1 - Rarely demonstrated</option>
                  <option value="2">2 - Occasionally demonstrated</option>
                  <option value="3">3 - Consistently demonstrated</option>
                  <option value="4">4 - Strong capability / frequently demonstrated</option>
                  <option value="5">5 - Role model / consistently drives impact</option>
                </select>
                <input className="input" value={comments[q.id] ?? ""} disabled={isFinalized} onChange={(e) => setComments((c) => ({ ...c, [q.id]: e.target.value }))} placeholder="Optional evidence comment" />
              </div>
            </div>
          );
        })}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="button ghost" onClick={() => saveRatings("draft")} disabled={saving || isFinalized}>Save draft</button>
          <button className="button" onClick={() => saveRatings("final")} disabled={saving || isFinalized}>Final submit</button>
          {isFinalized ? <button className="button ghost" onClick={reopenFinal} disabled={saving}>Reopen</button> : null}
        </div>
        {status ? <p className="meta" style={{ marginTop: 8 }}>{status}</p> : null}
      </section>

      <div className="print-report">
      <section className="card" style={{ marginBottom: 12 }}>
        <h2 style={{ marginTop: 0 }}>Visual report</h2>
        {!advancedSummary || advancedSummary.rows.length === 0 ? <p className="meta">No ratings yet.</p> : (
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
                    <div className="meta">self {r.selfAvg ?? "-"} · manager {r.managerAvg ?? "-"} · gap {r.gap ?? "-"}</div>
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
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(120px, 1fr))", gap: 8 }}>
              <div className="card"><strong>Overall self</strong><div className="meta">{executiveSummary.overallSelf}/5</div></div>
              <div className="card"><strong>Overall manager</strong><div className="meta">{executiveSummary.overallManager}/5</div></div>
              <div className="card"><strong>Net gap</strong><div className="meta">{executiveSummary.netGap}</div></div>
              <div className="card"><strong>Biggest mismatch</strong><div className="meta">{executiveSummary.biggestGap?.dimension ?? "-"}</div></div>
            </div>

            <div className="meta">
              Strongest area: <strong>{executiveSummary.strongest?.dimension ?? "-"}</strong>. Biggest alignment risk: <strong>{executiveSummary.biggestGap?.dimension ?? "-"}</strong>.
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <label className="meta">Sort by</label>
              <select className="select" value={sortBy} onChange={(e) => setSortBy(e.target.value as "gap" | "self" | "manager" | "capability") }>
                <option value="gap">Gap</option>
                <option value="self">Self score</option>
                <option value="manager">Manager score</option>
                <option value="capability">Capability</option>
              </select>
              <button className="button ghost print-hide" onClick={() => window.print()}>Print / Save PDF</button>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", borderBottom: "1px solid var(--border)", padding: "6px" }}>Capability</th>
                    <th style={{ textAlign: "left", borderBottom: "1px solid var(--border)", padding: "6px" }}>Self</th>
                    <th style={{ textAlign: "left", borderBottom: "1px solid var(--border)", padding: "6px" }}>Manager</th>
                    <th style={{ textAlign: "left", borderBottom: "1px solid var(--border)", padding: "6px" }}>Gap</th>
                    <th style={{ textAlign: "left", borderBottom: "1px solid var(--border)", padding: "6px" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reportRows.map((r) => {
                    const badge = r.absGap >= 1 ? "Priority" : r.absGap >= 0.5 ? "Watch" : "Aligned";
                    return (
                      <tr key={`rep-${r.dimension}`}>
                        <td style={{ borderBottom: "1px solid var(--border)", padding: "6px" }}>{r.dimension}</td>
                        <td style={{ borderBottom: "1px solid var(--border)", padding: "6px" }}>{r.selfAvg ?? "-"}</td>
                        <td style={{ borderBottom: "1px solid var(--border)", padding: "6px" }}>{r.managerAvg ?? "-"}</td>
                        <td style={{ borderBottom: "1px solid var(--border)", padding: "6px" }}>{r.gap ?? "-"}</td>
                        <td style={{ borderBottom: "1px solid var(--border)", padding: "6px" }}>{badge}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section className="card" style={{ marginBottom: 12 }}>
        <h2 style={{ marginTop: 0 }}>Evidence comments</h2>
        {commentsByDimension.length === 0 ? (
          <p className="meta">No evidence comments were provided.</p>
        ) : (
          <div className="grid" style={{ gap: 10 }}>
            {commentsByDimension.map((c) => (
              <div key={`comments-${c.dimension}`} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 10 }}>
                <strong>{c.dimension}</strong>
                <div className="meta" style={{ marginTop: 6 }}><strong>Self:</strong> {c.self.length ? c.self.join(" | ") : "No comment"}</div>
                <div className="meta" style={{ marginTop: 6 }}><strong>Manager:</strong> {c.manager.length ? c.manager.join(" | ") : "No comment"}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Development action plan (30/60/90)</h2>
        <div className="grid" style={{ gap: 8 }}>
          <input className="input" value={strengthsText} onChange={(e) => setStrengthsText(e.target.value)} placeholder="Top 2 strengths" />
          <input className="input" value={prioritiesText} onChange={(e) => setPrioritiesText(e.target.value)} placeholder="Top 2 development priorities" />
          <textarea className="input" value={plan30} onChange={(e) => setPlan30(e.target.value)} placeholder="30-day actions" rows={3} />
          <textarea className="input" value={plan60} onChange={(e) => setPlan60(e.target.value)} placeholder="60-day actions" rows={3} />
          <textarea className="input" value={plan90} onChange={(e) => setPlan90(e.target.value)} placeholder="90-day actions" rows={3} />
          <button className="button print-hide" onClick={saveActionPlan} disabled={savingPlan}>{savingPlan ? "Saving..." : "Save action plan"}</button>
        </div>
      </section>
      </div>
    </main>
  );
}
