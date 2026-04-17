"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import InterviewRadarChart from "@/components/InterviewRadarChart";
import { toneClass } from "@/lib/interviewReportUi";

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

export default function InterviewPrintPage() {
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

  const strongest = useMemo(() => [...scores].sort((a, b) => b.score - a.score)[0], [scores]);
  const weakest = useMemo(() => [...scores].sort((a, b) => a.score - b.score)[0], [scores]);

  return (
    <main className="page grid report-print-page">
      <div className="card surface-hero" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div>
          <h1 className="title" style={{ marginBottom: 4 }}>Print / PDF Behavioural Interview Report</h1>
          <p className="subtitle" style={{ marginBottom: 8 }}>Designed for client-facing export and executive review.</p>
          <span className="badge">Status: {status}</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/interview/${interviewId}/results`} className="button ghost" style={{ textDecoration: "none" }}>Back to web report</Link>
          <button className="button" onClick={() => window.print()}>Print / Save PDF</button>
        </div>
      </div>

      {scores.length === 0 || !report ? (
        <section className="card">
          <p className="meta">Scoring in progress or no report available yet.</p>
        </section>
      ) : (
        <div className="report-print-safe">
          <section className="report-sheet report-sheet-premium">
            <div className="report-sheet-header">
              <div>
                <div className="report-sheet-title">AI Behavioural Interview Executive Assessment</div>
                <div className="report-sheet-meta">Interview ID: {interviewId}</div>
              </div>
              <div className={`report-summary-pill ${toneClass(report.overallAverage)}`}>
                <div className="report-summary-pill-label">Overall rating</div>
                <div className="report-summary-pill-value">{report.overallRating}</div>
                <div className="report-summary-pill-sub">Average {report.overallAverage}/5</div>
              </div>
            </div>

            <div className="report-score-grid">
              <div className={`report-kpi-card ${strongest ? toneClass(strongest.score) : "score-strong"}`}>
                <div className="report-kpi-label">Strongest capability</div>
                <div className="report-kpi-value report-kpi-small">{strongest?.capability ?? "-"}</div>
              </div>
              <div className={`report-kpi-card ${weakest ? toneClass(weakest.score) : "score-low"}`}>
                <div className="report-kpi-label">Priority capability</div>
                <div className="report-kpi-value report-kpi-small">{weakest?.capability ?? "-"}</div>
              </div>
              <div className="report-kpi-card score-mid">
                <div className="report-kpi-label">Headline insight</div>
                <div className="report-kpi-value report-kpi-small">{report.headlineInsight}</div>
              </div>
            </div>
          </section>

          <section className="report-sheet report-sheet-premium">
            <div className="report-grid-2 report-grid-2-balanced">
              <div>
                <h2>Capability radar</h2>
                <InterviewRadarChart scores={scores.map((score) => ({ capability: score.capability, score: score.score }))} printMode />
              </div>
              <div>
                <h2>Score legend</h2>
                <div className="report-bullet-list">
                  <div className="report-bullet-item score-strong">Green, strong score, above 3.5</div>
                  <div className="report-bullet-item score-mid">Amber, mixed or developing score, around 3</div>
                  <div className="report-bullet-item score-low">Red, lower score, below 3</div>
                </div>
                <h2 style={{ marginTop: 18 }}>Top strengths</h2>
                <div className="report-bullet-list">
                  {report.topStrengths.map((item) => <div key={item} className="report-bullet-item score-strong">✓ {item}</div>)}
                </div>
                <h2 style={{ marginTop: 18 }}>Top development priorities</h2>
                <div className="report-bullet-list">
                  {report.topDevelopmentPriorities.map((item) => <div key={item} className="report-bullet-item score-low">→ {item}</div>)}
                </div>
              </div>
            </div>
          </section>

          <section className="report-sheet report-sheet-premium">
            <h2>Capability breakdown</h2>
            <div className="report-capability-grid">
              {report.capabilityBreakdown.map((item) => (
                <div key={item.capability} className={`report-capability-card ${toneClass(item.score)}`}>
                  <div className="report-capability-header">
                    <div>
                      <strong>{item.capability}</strong>
                      <div className="meta">{item.level}</div>
                    </div>
                    <span className={`badge ${toneClass(item.score)}`}>{item.score}/5</span>
                  </div>
                  <p className="report-summary-text">{item.evidence}</p>
                  <div className="report-mini-block"><strong>Benchmark</strong><span>{item.benchmark}</span></div>
                  <div className="report-mini-block"><strong>Impact</strong><span>{item.impactStatement}</span></div>
                  <div className="report-mini-grid">
                    <div>
                      <strong>Strengths</strong>
                      <ul>{item.strengths.map((entry) => <li key={entry}>{entry}</li>)}</ul>
                    </div>
                    <div>
                      <strong>Development focus</strong>
                      <ul>{item.gaps.map((entry) => <li key={entry}>{entry}</li>)}</ul>
                    </div>
                  </div>
                  <div className="report-mini-block"><strong>Recommended next steps</strong><ul>{item.coachingRecommendations.map((entry) => <li key={entry}>{entry}</li>)}</ul></div>
                </div>
              ))}
            </div>
          </section>

          <section className="report-sheet report-sheet-premium">
            <div className="report-grid-3">
              <div className="print-text-block score-strong">
                <strong>Start doing</strong>
                <ul>{report.developmentPlan.startDoing.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
              <div className="print-text-block score-low">
                <strong>Stop doing</strong>
                <ul>{report.developmentPlan.stopDoing.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
              <div className="print-text-block score-mid">
                <strong>Do more of</strong>
                <ul>{report.developmentPlan.doMoreOf.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
