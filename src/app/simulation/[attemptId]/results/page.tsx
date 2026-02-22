"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

type Evidence = { id: string; domain: string; indicator: string; strength: "strong" | "moderate" | "weak"; confidence: number; notes: string };
type Score = { id: string; domain: string; score: number; maturity: "foundation" | "advanced" | "future_ready"; evidence_count: number };
type Job = { id: string; status: "pending" | "running" | "completed" | "failed"; last_error: string | null };

const INDICATORS_BY_DOMAIN: Record<string, string[]> = {
  Curiosity: ["Asks focused discovery questions", "Explores root cause before solutioning", "Clarifies constraints and success criteria"],
  "Value Discovery": ["Connects problem to measurable business outcomes", "Quantifies impact or ROI hypothesis", "Links technical capability to stakeholder value"],
  "Executive Presence": ["Communicates with concise structure", "Handles challenge calmly and confidently", "Uses clear business language over jargon"],
  Influence: ["Aligns stakeholders around next step", "Reframes objections into decision criteria", "Builds momentum with clear recommendation"],
  "Commercial Ownership": ["Drives conversation toward commercial outcomes", "Surfaces risk, urgency, and trade-offs", "Secures concrete next-step commitment"],
};

export default function SimulationResultsPage() {
  const params = useParams<{ attemptId: string }>();
  const search = useSearchParams();
  const attemptId = params?.attemptId;
  const jobId = search.get("jobId");

  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [job, setJob] = useState<Job | null>(null);
  const [status, setStatus] = useState("loading");

  const loadResults = useCallback(async () => {
    if (!attemptId) return;
    const res = await fetch(`/api/simulations/${attemptId}/results`, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) return setStatus(`error: ${json.error ?? "failed"}`);
    setEvidence(json.evidence ?? []);
    setScores(json.scores ?? []);
    setJob(json.job ?? null);
    const js = json.job?.status;
    if (js === "completed") setStatus("completed");
    else if (js === "failed") setStatus("failed");
    else setStatus("scoring");
  }, [attemptId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadResults(); }, [loadResults]);
  useEffect(() => {
    if (!attemptId || (status !== "scoring" && status !== "loading")) return;
    const t = setInterval(() => { void loadResults(); }, 2500);
    return () => clearInterval(t);
  }, [attemptId, status, loadResults]);

  const groupedEvidence = useMemo(() => evidence.reduce<Record<string, Evidence[]>>((acc, item) => {
    acc[item.domain] = acc[item.domain] ?? [];
    acc[item.domain].push(item);
    return acc;
  }, {}), [evidence]);

  return (
    <main className="page grid">
      <div>
        <h1 className="title">Simulation Results</h1>
        <p className="subtitle">Attempt: {attemptId}</p>
        {jobId ? <p className="meta">Job: {jobId}</p> : null}
        <span className={`badge ${status === "completed" ? "success" : status === "failed" ? "error" : ""}`}>Status: {status}</span>
      </div>

      {job?.status === "failed" ? (
        <section className="card" style={{ borderColor: "#fecaca" }}>
          <strong>Scoring failed.</strong>
          <p className="meta" style={{ marginTop: 8 }}>{job.last_error ?? "Unknown error"}</p>
        </section>
      ) : null}

      <section className="card grid">
        <h2 style={{ margin: 0 }}>Domain Scores</h2>
        {scores.length === 0 ? <p className="meta">No scores yet.</p> : (
          <div className="grid">
            {scores.map((s) => {
              const indicators = INDICATORS_BY_DOMAIN[s.domain] ?? [];
              const domainEvidence = groupedEvidence[s.domain] ?? [];
              const matched = indicators.filter((i) => domainEvidence.some((e) => `${e.indicator} ${e.notes}`.toLowerCase().includes(i.toLowerCase().slice(0, 18))));
              const missed = indicators.filter((i) => !matched.includes(i));
              return (
                <div key={s.id} className="card" style={{ padding: 12 }}>
                  <strong>{s.domain}</strong>
                  <div className="meta">Maturity: {s.maturity} · Evidence: {s.evidence_count}</div>
                  <div className="scoreBar" style={{ marginTop: 8 }}><span style={{ width: `${(s.score / 5) * 100}%` }} /></div>
                  <div style={{ marginTop: 6, fontWeight: 600 }}>{s.score} / 5</div>
                  {matched.length ? <div className="meta" style={{ marginTop: 6 }}><strong>Matched:</strong> {matched.join("; ")}</div> : null}
                  {missed.length ? <div className="meta" style={{ marginTop: 4 }}><strong>Missing:</strong> {missed.join("; ")}</div> : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="card grid">
        <h2 style={{ margin: 0 }}>Evidence</h2>
        {Object.keys(groupedEvidence).length === 0 ? <p className="meta">No evidence yet.</p> : (
          Object.entries(groupedEvidence).map(([domain, items]) => (
            <div key={domain}>
              <h3 style={{ marginBottom: 8 }}>{domain}</h3>
              <div className="grid">
                {items.map((e) => (
                  <div key={e.id} className="card" style={{ padding: 10 }}>
                    <strong>{e.indicator}</strong>
                    <div className="meta">{e.strength} · confidence {Math.round(e.confidence * 100)}%</div>
                    {e.notes ? <div style={{ marginTop: 6 }}>{e.notes}</div> : null}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    </main>
  );
}
