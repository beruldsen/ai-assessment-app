"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

type Evidence = {
  id: string;
  domain: string;
  indicator: string;
  strength: "strong" | "moderate" | "weak";
  confidence: number;
  notes: string;
};

type Score = {
  id: string;
  domain: string;
  score: number;
  maturity: "foundation" | "advanced" | "future_ready";
  evidence_count: number;
};

type Job = {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  last_error: string | null;
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

  async function loadResults() {
    if (!attemptId) return;
    const res = await fetch(`/api/simulations/${attemptId}/results`, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) {
      setStatus(`error: ${json.error ?? "failed"}`);
      return;
    }

    setEvidence(json.evidence ?? []);
    setScores(json.scores ?? []);
    setJob(json.job ?? null);

    const js = json.job?.status;
    if (js === "completed") setStatus("completed");
    else if (js === "failed") setStatus("failed");
    else setStatus("scoring");
  }

  useEffect(() => {
    loadResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  useEffect(() => {
    if (!attemptId) return;
    if (status !== "scoring" && status !== "loading") return;

    const t = setInterval(() => {
      loadResults();
    }, 2500);

    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId, status]);

  const groupedEvidence = useMemo(() => {
    return evidence.reduce<Record<string, Evidence[]>>((acc, item) => {
      acc[item.domain] = acc[item.domain] ?? [];
      acc[item.domain].push(item);
      return acc;
    }, {});
  }, [evidence]);

  return (
    <main style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      <h1>Simulation Results</h1>
      <p>Attempt: {attemptId}</p>
      {jobId ? <p>Job: {jobId}</p> : null}
      <p>Status: {status}</p>

      {job?.status === "failed" ? (
        <div style={{ border: "1px solid #f5a", padding: 12, borderRadius: 8, margin: "12px 0" }}>
          <strong>Scoring failed.</strong>
          <p style={{ marginTop: 8 }}>{job.last_error ?? "Unknown error"}</p>
        </div>
      ) : null}

      <h2>Scores</h2>
      {scores.length === 0 ? (
        <p style={{ opacity: 0.7 }}>No scores yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {scores.map((s) => (
            <div key={s.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 10 }}>
              <strong>{s.domain}</strong>
              <div>Score: {s.score} / 5</div>
              <div>Maturity: {s.maturity}</div>
              <div>Evidence count: {s.evidence_count}</div>
            </div>
          ))}
        </div>
      )}

      <h2 style={{ marginTop: 20 }}>Evidence</h2>
      {Object.keys(groupedEvidence).length === 0 ? (
        <p style={{ opacity: 0.7 }}>No evidence yet.</p>
      ) : (
        Object.entries(groupedEvidence).map(([domain, items]) => (
          <section key={domain} style={{ marginBottom: 14 }}>
            <h3>{domain}</h3>
            <ul>
              {items.map((e) => (
                <li key={e.id} style={{ marginBottom: 8 }}>
                  <strong>{e.indicator}</strong> ({e.strength}, confidence {Math.round(e.confidence * 100)}%)
                  {e.notes ? <div style={{ opacity: 0.85 }}>{e.notes}</div> : null}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </main>
  );
}
