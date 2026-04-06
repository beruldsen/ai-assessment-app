"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

type InterviewScore = {
  id: string;
  capability: string;
  score: number;
  evidence_summary: string | null;
  strengths: string[];
  development_areas: string[];
  behavioural_patterns: string[];
  coaching_recommendations: string[];
};

export default function InterviewResultsPage() {
  const params = useParams<{ interviewId: string }>();
  const interviewId = params?.interviewId;

  const [scores, setScores] = useState<InterviewScore[]>([]);
  const [status, setStatus] = useState("loading");

  const load = useCallback(async () => {
    if (!interviewId) return;
    const res = await fetch(`/api/interviews/${interviewId}`, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) {
      setStatus(`error: ${json.error ?? "failed"}`);
      return;
    }
    setScores(json.scores ?? []);
    setStatus((json.scores ?? []).length ? "completed" : "pending");
  }, [interviewId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (status !== "pending") return;
    const t = setInterval(() => void load(), 2500);
    return () => clearInterval(t);
  }, [status, load]);

  return (
    <main className="page grid">
      <div>
        <h1 className="title">Interview Results</h1>
        <p className="subtitle">Interview ID: {interviewId}</p>
        <span className="badge">Status: {status}</span>
      </div>

      <section className="card grid">
        {scores.length === 0 ? <p className="meta">Scoring in progress or no scores yet.</p> : scores.map((score) => (
          <div key={score.id} className="card" style={{ padding: 12 }}>
            <strong>{score.capability}</strong>
            <div className="meta">Score: {score.score} / 5</div>
            {score.evidence_summary ? <p>{score.evidence_summary}</p> : null}
            {score.strengths?.length ? <p className="meta"><strong>Strengths:</strong> {score.strengths.join("; ")}</p> : null}
            {score.development_areas?.length ? <p className="meta"><strong>Development areas:</strong> {score.development_areas.join("; ")}</p> : null}
            {score.behavioural_patterns?.length ? <p className="meta"><strong>Patterns:</strong> {score.behavioural_patterns.join("; ")}</p> : null}
            {score.coaching_recommendations?.length ? <p className="meta"><strong>Coaching:</strong> {score.coaching_recommendations.join("; ")}</p> : null}
          </div>
        ))}
      </section>
    </main>
  );
}
