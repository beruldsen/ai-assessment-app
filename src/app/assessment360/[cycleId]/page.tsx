"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ASSESSMENT_180_CAPABILITIES, ASSESSMENT_360_QUESTIONS, type RaterType } from "@/lib/assessment360";

type SubmissionState = {
  rater_type: RaterType;
  status: "draft" | "final_submitted";
  submitted_at: string | null;
  version: number;
};

type ApiResponse = {
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

  async function load() {
    setStatus("loading...");
    const res = await fetch(`/api/assessment360/cycles/${cycleId}`);
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
      return { dimension, selfAvg, managerAvg, overallAvg, gap };
    });

    const strengths = [...rows].sort((a, b) => b.overallAvg - a.overallAvg).slice(0, 3);
    const development = [...rows].sort((a, b) => a.overallAvg - b.overallAvg).slice(0, 3);

    return { rows, strengths, development };
  }, [data]);

  async function saveRatings(mode: "draft" | "final") {
    const answers = ASSESSMENT_360_QUESTIONS
      .map((q) => ({
        questionId: q.id,
        score: Number(scores[q.id]),
        comment: comments[q.id] ?? "",
      }))
      .filter((a) => Number.isFinite(a.score) && a.score >= 1 && a.score <= 5);

    if (answers.length === 0) {
      setStatus("Please score at least one question before saving.");
      return;
    }

    setSaving(true);
    setStatus(mode === "final" ? "finalizing..." : "saving draft...");

    const res = await fetch(`/api/assessment360/cycles/${cycleId}/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raterType: tab, answers, mode }),
    });

    const json = await res.json();
    if (!res.ok) {
      setStatus(`error: ${json.error ?? "failed to save"}`);
      setSaving(false);
      return;
    }

    await load();
    setSaving(false);
    setStatus(mode === "final" ? `Final submitted for ${tab}.` : `Saved ${answers.length} ${tab} ratings as draft.`);
  }

  async function reopenFinal() {
    const answers = ASSESSMENT_360_QUESTIONS
      .map((q) => ({
        questionId: q.id,
        score: Number(scores[q.id]),
        comment: comments[q.id] ?? "",
      }))
      .filter((a) => Number.isFinite(a.score) && a.score >= 1 && a.score <= 5);

    if (!answers.length) {
      setStatus("Cannot reopen without existing answers loaded.");
      return;
    }

    setSaving(true);
    const res = await fetch(`/api/assessment360/cycles/${cycleId}/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raterType: tab, answers, mode: "draft", forceEditAfterFinal: true }),
    });
    const json = await res.json();
    if (!res.ok) setStatus(`error: ${json.error ?? "failed to reopen"}`);
    else setStatus(`${tab} reopened to draft.`);
    setSaving(false);
    await load();
  }

  async function saveActionPlan() {
    setSavingPlan(true);
    const res = await fetch(`/api/assessment360/cycles/${cycleId}/action-plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ strengths: strengthsText, priorities: prioritiesText, plan30, plan60, plan90 }),
    });
    const json = await res.json();
    setSavingPlan(false);
    if (!res.ok) {
      setStatus(`error: ${json.error ?? "failed to save action plan"}`);
      return;
    }
    setStatus("Saved development action plan.");
    await load();
  }

  return (
    <main className="page">
      <h1 className="title">Future SE 180° Assessment Cycle</h1>
      <p className="subtitle">
        {data ? `${data.cycle.title} · ${data.cycle.participant_name}` : "Loading..."}
      </p>

      <section className="card" style={{ marginBottom: 12 }}>
        <div className="progress" style={{ marginBottom: 10 }}>
          <button className={`step ${tab === "self" ? "active" : ""}`} onClick={() => setTab("self")}>Self</button>
          <button className={`step ${tab === "manager" ? "active" : ""}`} onClick={() => setTab("manager")}>Manager</button>
        </div>
        <p className="meta">Purpose: development-first feedback, not punitive scoring.</p>
        <p className="meta">Rate observed behavior from this cycle period and use comments as evidence.</p>
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
                {capability.behaviors.map((b, i) => (
                  <li key={`${capability.id}-${i}`} style={{ marginBottom: 4 }}>{b}</li>
                ))}
              </ul>
              <div style={{ display: "grid", gap: 8 }}>
                <select
                  className="select"
                  value={scores[q.id] ?? ""}
                  disabled={isFinalized}
                  onChange={(e) => setScores((s) => ({ ...s, [q.id]: Number(e.target.value) }))}
                >
                  <option value="">Score (1-5)</option>
                  <option value="1">1 - Rarely demonstrated</option>
                  <option value="2">2 - Occasionally demonstrated</option>
                  <option value="3">3 - Consistently demonstrated</option>
                  <option value="4">4 - Strong capability / frequently demonstrated</option>
                  <option value="5">5 - Role model / consistently drives impact</option>
                </select>
                <input
                  className="input"
                  value={comments[q.id] ?? ""}
                  disabled={isFinalized}
                  onChange={(e) => setComments((c) => ({ ...c, [q.id]: e.target.value }))}
                  placeholder="Optional evidence comment"
                />
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

      <section className="card" style={{ marginBottom: 12 }}>
        <h2 style={{ marginTop: 0 }}>Summary</h2>
        {!data ? (
          <p className="meta">No data yet.</p>
        ) : (
          <div className="grid">
            <div>
              <strong>Average by rater</strong>
              {data.summary.raterAverages.length === 0 ? (
                <p className="meta">No ratings yet.</p>
              ) : data.summary.raterAverages.map((r) => (
                <p key={r.raterType} className="meta" style={{ margin: "6px 0" }}>
                  {r.raterType}: {r.avgScore} / 5
                </p>
              ))}
            </div>

            <div>
              <strong>Self vs Manager gap by capability</strong>
              {!advancedSummary || advancedSummary.rows.length === 0 ? (
                <p className="meta">No ratings yet.</p>
              ) : (
                <div className="grid" style={{ marginTop: 8 }}>
                  {advancedSummary.rows.map((r) => (
                    <div key={r.dimension} className="meta">
                      <strong>{r.dimension}</strong>
                      <div>
                        self: {r.selfAvg ?? "-"} · manager: {r.managerAvg ?? "-"} · gap: {r.gap ?? "-"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
          <div>
            <button className="button" onClick={saveActionPlan} disabled={savingPlan}>{savingPlan ? "Saving..." : "Save action plan"}</button>
          </div>
        </div>
      </section>
    </main>
  );
}
