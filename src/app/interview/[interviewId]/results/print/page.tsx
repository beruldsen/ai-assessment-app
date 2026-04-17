"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
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
  executiveNarrative: string;
  evidenceHighlights: Array<{ capability: string; quote: string; whyItMatters: string }>;
  developmentPlan: {
    startDoing: string[];
    stopDoing: string[];
    doMoreOf: string[];
  };
  capabilityBreakdown: Array<{
    capability: string;
    score: number;
    level: string;
    evidence: string;
    scoreRationale: string;
    strengths: string[];
    gaps: string[];
    benchmark: string;
    impactStatement: string;
    coachingRecommendations: string[];
    interviewInsight: string;
    participantEvidence: string[];
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
                <p className="meta" style={{ marginTop: 10 }}>{report.executiveNarrative}</p>
              </div>
              <div className={`report-summary-pill ${toneClass(report.overallAverage)}`}>
                <div className="report-summary-pill-label">Overall rating</div>
                <div className="report-summary-pill-value">{report.overallRating}</div>
                <div className="report-summary-pill-sub">Average {report.overallAverage}/5</div>
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
                <h2>Interview evidence highlights</h2>
                <div className="report-quote-list">
                  {report.evidenceHighlights.map((item) => (
                    <div key={item.capability} className="report-quote-card">
                      <div className={`report-quote-tag ${toneClass(report.capabilityBreakdown.find((row) => row.capability === item.capability)?.score ?? 3)}`}>{item.capability}</div>
                      <blockquote>{item.quote}</blockquote>
                      <p>{item.whyItMatters}</p>
                    </div>
                  ))}
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
                  <div className="report-mini-block"><strong>Reason for score</strong><span>{item.scoreRationale}</span></div>
                  {item.participantEvidence.length ? <div className="report-mini-block"><strong>What the participant said</strong><ul>{item.participantEvidence.map((entry) => <li key={entry}>{entry}</li>)}</ul></div> : null}
                  <div className="report-mini-block"><strong>Interview insight</strong><span>{item.interviewInsight}</span></div>
                  <div className="report-mini-block"><strong>Assessment summary</strong><span>{item.evidence}</span></div>
                  <div className="report-mini-block"><strong>Benchmark</strong><span>{item.benchmark}</span></div>
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
        </div>
      )}
    </main>
  );
}
