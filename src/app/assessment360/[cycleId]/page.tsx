"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ASSESSMENT_360_QUESTIONS, type RaterType } from "@/lib/assessment360";

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

  const [scores, setScores] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});

  async function load() {
    setStatus("loading...");
    const res = await fetch(`/api/assessment360/cycles/${cycleId}`);
    const json = (await res.json()) as ApiResponse | { error: string };
    if (!res.ok) {
      const message = "error" in json ? json.error : "failed";
      setStatus(`error: ${message}`);
      return;
    }
    setData(json as ApiResponse);
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

  async function saveRatings() {
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
    setStatus("saving...");

    const res = await fetch(`/api/assessment360/cycles/${cycleId}/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raterType: tab, answers }),
    });

    const json = await res.json();
    if (!res.ok) {
      setStatus(`error: ${json.error ?? "failed to save"}`);
      setSaving(false);
      return;
    }

    await load();
    setSaving(false);
    setStatus(`Saved ${answers.length} ${tab} ratings.`);
  }

  return (
    <main className="page">
      <h1 className="title">360 Assessment Cycle</h1>
      <p className="subtitle">
        {data ? `${data.cycle.title} · ${data.cycle.participant_name}` : "Loading..."}
      </p>

      <section className="card" style={{ marginBottom: 12 }}>
        <div className="progress" style={{ marginBottom: 10 }}>
          <button className={`step ${tab === "self" ? "active" : ""}`} onClick={() => setTab("self")}>Self</button>
          <button className={`step ${tab === "manager" ? "active" : ""}`} onClick={() => setTab("manager")}>Manager</button>
        </div>
        <p className="meta">{tab.toUpperCase()} completion: {completion.done}/{completion.total}</p>
      </section>

      <section className="card grid" style={{ marginBottom: 12 }}>
        {ASSESSMENT_360_QUESTIONS.map((q, idx) => (
          <div key={q.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
            <div style={{ fontWeight: 600 }}>{idx + 1}. {q.text}</div>
            <div className="meta" style={{ marginBottom: 6 }}>{q.dimension}</div>
            <div style={{ display: "grid", gap: 8 }}>
              <select
                className="select"
                value={scores[q.id] ?? ""}
                onChange={(e) => setScores((s) => ({ ...s, [q.id]: Number(e.target.value) }))}
              >
                <option value="">Score (1-5)</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <input
                className="input"
                value={comments[q.id] ?? ""}
                onChange={(e) => setComments((c) => ({ ...c, [q.id]: e.target.value }))}
                placeholder="Optional evidence comment"
              />
            </div>
          </div>
        ))}

        <div>
          <button className="button" onClick={saveRatings} disabled={saving}>Save {tab} ratings</button>
          {status ? <p className="meta" style={{ marginTop: 8 }}>{status}</p> : null}
        </div>
      </section>

      <section className="card">
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

            <div>
              <strong>Top 3 strengths</strong>
              {!advancedSummary || advancedSummary.strengths.length === 0 ? (
                <p className="meta">No ratings yet.</p>
              ) : (
                <ol className="meta" style={{ marginTop: 8 }}>
                  {advancedSummary.strengths.map((s) => (
                    <li key={`s-${s.dimension}`}>{s.dimension} ({s.overallAvg}/5)</li>
                  ))}
                </ol>
              )}
            </div>

            <div>
              <strong>Top 3 development priorities</strong>
              {!advancedSummary || advancedSummary.development.length === 0 ? (
                <p className="meta">No ratings yet.</p>
              ) : (
                <ol className="meta" style={{ marginTop: 8 }}>
                  {advancedSummary.development.map((d) => (
                    <li key={`d-${d.dimension}`}>{d.dimension} ({d.overallAvg}/5)</li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
