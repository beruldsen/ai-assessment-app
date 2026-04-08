"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
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

type InterviewReport = {
  overallRating: string;
  overallAverage: number;
  headlineInsight: string;
  topStrengths: string[];
  topDevelopmentPriorities: string[];
  behaviouralInsights: string[];
  strengthsProfile: string[];
  developmentPlan: {
    startDoing: string[];
    stopDoing: string[];
    doMoreOf: string[];
  };
  managerCoachingGuide: {
    supportActions: string[];
    coachingQuestions: string[];
    liveDealObservations: string[];
  };
  capabilityBreakdown: Array<{
    capability: string;
    score: number;
    level: string;
    evidence: string;
    strengths: string[];
    gaps: string[];
    benchmark: string;
    impactStatement: string;
    behaviouralPatterns: string[];
    coachingRecommendations: string[];
  }>;
};

function scoreTone(score: number) {
  if (score >= 4.5) return "success";
  if (score >= 3.6) return "secondary";
  if (score >= 2.8) return "primary";
  return "warning";
}

export default function InterviewResultsPage() {
  const params = useParams<{ interviewId: string }>();
  const interviewId = params?.interviewId;

  const [scores, setScores] = useState<InterviewScore[]>([]);
  const [report, setReport] = useState<InterviewReport | null>(null);
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
    setReport(json.report ?? null);
    setStatus((json.scores ?? []).length ? "completed" : "pending");
  }, [interviewId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (status !== "pending") return;
    const t = setInterval(() => void load(), 2500);
    return () => clearInterval(t);
  }, [status, load]);

  const strongest = useMemo(() => [...scores].sort((a, b) => b.score - a.score)[0], [scores]);
  const weakest = useMemo(() => [...scores].sort((a, b) => a.score - b.score)[0], [scores]);

  return (
    <main className="page grid report-print-page">
      <div className="card surface-hero" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div>
          <h1 className="title" style={{ marginBottom: 4 }}>Behavioural Interview Report</h1>
          <p className="subtitle" style={{ marginBottom: 8 }}>Interview ID: {interviewId}</p>
          <span className="badge">Status: {status}</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/interview/${interviewId}`} className="button ghost" style={{ textDecoration: "none" }}>Back to interview</Link>
          <Link href={`/interview/${interviewId}/results/print`} className="button" style={{ textDecoration: "none" }}>Open print / PDF view</Link>
        </div>
      </div>

      {scores.length === 0 || !report ? (
        <section className="card">
          <p className="meta">Scoring in progress or no report available yet.</p>
        </section>
      ) : (
        <div className="report-print-safe">
          <section className="report-sheet">
            <div className="report-sheet-header">
              <div>
                <div className="report-sheet-title">AI Behavioural Interview Report</div>
                <div className="report-sheet-meta">Sales Engineering capability assessment</div>
              </div>
              <div className="report-sheet-meta report-sheet-meta-right">
                <div>Overall rating: {report.overallRating}</div>
                <div>Overall average: {report.overallAverage}/5</div>
              </div>
            </div>

            <div className="report-sheet-section">
              <h2>Executive summary</h2>
              <div className="print-kpi-grid">
                <div className="print-kpi-box"><strong>Overall rating</strong><span>{report.overallRating}</span></div>
                <div className="print-kpi-box"><strong>Overall average</strong><span>{report.overallAverage}/5</span></div>
                <div className="print-kpi-box"><strong>Strongest capability</strong><span>{strongest?.capability ?? "-"}</span></div>
                <div className="print-kpi-box"><strong>Top development priority</strong><span>{weakest?.capability ?? "-"}</span></div>
              </div>
              <div className="print-text-block" style={{ marginTop: 10 }}>
                <strong>Headline insight</strong>
                <div className="meta" style={{ marginTop: 4 }}>{report.headlineInsight}</div>
              </div>
            </div>

            <div className="report-sheet-section">
              <h2>Top strengths</h2>
              <div className="print-legend-list">
                {report.topStrengths.map((item) => (
                  <div key={item} className="print-legend-item">{item}</div>
                ))}
              </div>
            </div>

            <div className="report-sheet-section">
              <h2>Top development priorities</h2>
              <div className="print-legend-list">
                {report.topDevelopmentPriorities.map((item) => (
                  <div key={item} className="print-legend-item">{item}</div>
                ))}
              </div>
            </div>
          </section>

          <section className="report-sheet">
            <div className="report-sheet-section">
              <h2>Capability breakdown</h2>
              <div className="grid">
                {report.capabilityBreakdown.map((item) => (
                  <div key={item.capability} className="card" style={{ padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <strong>{item.capability}</strong>
                      <span className={`badge ${scoreTone(item.score) === "success" ? "success" : ""}`}>Score: {item.score}/5 · {item.level}</span>
                    </div>
                    <p style={{ marginBottom: 8 }}>{item.evidence}</p>
                    <div className="meta" style={{ marginBottom: 6 }}><strong>Benchmark:</strong> {item.benchmark}</div>
                    <div className="meta" style={{ marginBottom: 10 }}><strong>Impact:</strong> {item.impactStatement}</div>
                    {item.strengths.length ? <div className="meta" style={{ marginBottom: 6 }}><strong>Strengths:</strong> {item.strengths.join("; ")}</div> : null}
                    {item.gaps.length ? <div className="meta" style={{ marginBottom: 6 }}><strong>Gaps vs high performance:</strong> {item.gaps.join("; ")}</div> : null}
                    {item.behaviouralPatterns.length ? <div className="meta" style={{ marginBottom: 6 }}><strong>Patterns:</strong> {item.behaviouralPatterns.join("; ")}</div> : null}
                    {item.coachingRecommendations.length ? <div className="meta"><strong>Recommended next steps:</strong> {item.coachingRecommendations.join("; ")}</div> : null}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="report-sheet">
            <div className="report-sheet-section">
              <h2>Strengths profile</h2>
              <div className="print-legend-list">
                {report.strengthsProfile.map((item) => (
                  <div key={item} className="print-legend-item">{item}</div>
                ))}
              </div>
            </div>
          </section>

          <section className="report-sheet">
            <div className="report-sheet-section">
              <h2>Practical development plan</h2>
              <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                <div className="print-text-block">
                  <strong>Start doing</strong>
                  <ul style={{ margin: "8px 0 0 18px", padding: 0 }}>
                    {report.developmentPlan.startDoing.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
                <div className="print-text-block">
                  <strong>Stop doing</strong>
                  <ul style={{ margin: "8px 0 0 18px", padding: 0 }}>
                    {report.developmentPlan.stopDoing.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
                <div className="print-text-block">
                  <strong>Do more of</strong>
                  <ul style={{ margin: "8px 0 0 18px", padding: 0 }}>
                    {report.developmentPlan.doMoreOf.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          </section>

        </div>
      )}
    </main>
  );
}
