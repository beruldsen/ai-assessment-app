"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import InterviewRadarChart from "@/components/InterviewRadarChart";
import { scoreTone, toneClass, toneLabel } from "@/lib/interviewReportUi";

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
    scoreRationale: string;
    strengths: string[];
    gaps: string[];
    benchmark: string;
    impactStatement: string;
    behaviouralPatterns: string[];
    coachingRecommendations: string[];
    interviewInsight: string;
    participantEvidence: string[];
  }>;
};

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
    <main className="page grid report-page-shell report-print-page">
      <div className="card surface-hero report-hero">
        <div>
          <div className="eyebrow">AI Behavioural Interview Report</div>
          <h1 className="title" style={{ marginBottom: 6 }}>Sales Engineering Executive Assessment</h1>
          <p className="subtitle" style={{ marginBottom: 10 }}>Evidence-grounded behavioural review with score rationale, interview insight, and client-ready presentation.</p>
          <div className="report-chip-row">
            <span className="badge">Interview ID: {interviewId}</span>
            <span className={`badge ${toneClass(report?.overallAverage ?? 3)}`}>Status: {status}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href={`/interview/${interviewId}`} className="button ghost" style={{ textDecoration: "none" }}>Back to interview</Link>
          <Link href={`/interview/${interviewId}/results/print`} className="button" style={{ textDecoration: "none" }}>Open print / PDF view</Link>
        </div>
      </div>

      {scores.length === 0 || !report ? (
        <section className="card">
          <p className="meta">Scoring in progress or no report available yet.</p>
        </section>
      ) : (
        <div className="report-print-safe report-stack-lg">
          <section className="report-sheet report-sheet-premium">
            <div className="report-sheet-header report-grid-2">
              <div>
                <div className="report-sheet-title">Executive summary</div>
                <div className="report-sheet-meta">A concise view of current capability profile, strongest behavioural signals, and highest-value development priorities.</div>
              </div>
              <div className={`report-summary-pill ${toneClass(report.overallAverage)}`}>
                <div className="report-summary-pill-label">Overall rating</div>
                <div className="report-summary-pill-value">{report.overallRating}</div>
                <div className="report-summary-pill-sub">Average {report.overallAverage}/5</div>
              </div>
            </div>

            <div className="report-score-grid">
              <div className={`report-kpi-card ${toneClass(report.overallAverage)}`}>
                <div className="report-kpi-label">Overall signal</div>
                <div className="report-kpi-value">{toneLabel(report.overallAverage)}</div>
                <div className="report-kpi-sub">{report.overallRating}</div>
              </div>
              <div className={`report-kpi-card ${strongest ? toneClass(strongest.score) : "score-strong"}`}>
                <div className="report-kpi-label">Strongest capability</div>
                <div className="report-kpi-value report-kpi-small">{strongest?.capability ?? "-"}</div>
                <div className="report-kpi-sub">{strongest ? `${strongest.score}/5` : ""}</div>
              </div>
              <div className={`report-kpi-card ${weakest ? toneClass(weakest.score) : "score-low"}`}>
                <div className="report-kpi-label">Top development priority</div>
                <div className="report-kpi-value report-kpi-small">{weakest?.capability ?? "-"}</div>
                <div className="report-kpi-sub">{weakest ? `${weakest.score}/5` : ""}</div>
              </div>
            </div>

            <div className="report-grid-2 report-section-gap">
              <div className="print-text-block report-insight-card">
                <div className="section-icon">✦</div>
                <strong>Headline insight</strong>
                <p className="meta" style={{ marginTop: 8 }}>{report.headlineInsight}</p>
                <p className="meta" style={{ marginTop: 10 }}>{report.executiveNarrative}</p>
              </div>
              <div className="print-text-block report-legend-card">
                <strong>Score guide</strong>
                <div className="report-legend-list" style={{ marginTop: 10 }}>
                  <div className="report-legend-entry"><span className="report-swatch score-strong" /> Strong, above 3.5, clear behavioural evidence</div>
                  <div className="report-legend-entry"><span className="report-swatch score-mid" /> Mixed, around 3, some evidence but not yet consistently high-level</div>
                  <div className="report-legend-entry"><span className="report-swatch score-low" /> Lower, below 3, limited or inconsistent evidence</div>
                </div>
              </div>
            </div>
          </section>

          <section className="report-sheet report-sheet-premium">
            <div className="report-grid-2 report-grid-2-balanced">
              <div>
                <div className="report-sheet-title">Capability radar</div>
                <div className="report-sheet-meta">Visual profile of current capability strength across the assessed areas.</div>
                <InterviewRadarChart scores={scores.map((score) => ({ capability: score.capability, score: score.score }))} />
              </div>
              <div>
                <div className="report-sheet-title">Interview evidence highlights</div>
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
            <div className="report-sheet-section">
              <h2>Capability breakdown</h2>
              <div className="report-capability-grid">
                {report.capabilityBreakdown.map((item) => (
                  <div key={item.capability} className={`report-capability-card ${toneClass(item.score)}`}>
                    <div className="report-capability-header">
                      <div>
                        <strong>{item.capability}</strong>
                        <div className="meta">{item.level} capability signal</div>
                      </div>
                      <span className={`badge ${toneClass(item.score)}`}>{item.score}/5</span>
                    </div>

                    <div className="report-mini-block">
                      <strong>Reason for score</strong>
                      <span>{item.scoreRationale}</span>
                    </div>

                    {item.participantEvidence.length ? (
                      <div className="report-mini-block">
                        <strong>What the participant said</strong>
                        <ul>{item.participantEvidence.map((entry) => <li key={entry}>{entry}</li>)}</ul>
                      </div>
                    ) : null}

                    <div className="report-mini-block">
                      <strong>Interview insight</strong>
                      <span>{item.interviewInsight}</span>
                    </div>

                    <div className="report-mini-block"><strong>Assessment summary</strong><span>{item.evidence}</span></div>
                    <div className="report-mini-block"><strong>Benchmark</strong><span>{item.benchmark}</span></div>
                    <div className="report-mini-block"><strong>Client impact</strong><span>{item.impactStatement}</span></div>

                    <div className="report-mini-grid">
                      <div>
                        <strong>Strengths to leverage</strong>
                        <ul>{item.strengths.map((entry) => <li key={entry}>{entry}</li>)}</ul>
                      </div>
                      <div>
                        <strong>Development focus</strong>
                        <ul>{item.gaps.map((entry) => <li key={entry}>{entry}</li>)}</ul>
                      </div>
                    </div>

                    {item.coachingRecommendations.length ? (
                      <div className="report-mini-block">
                        <strong>Recommended next steps</strong>
                        <ul>{item.coachingRecommendations.map((entry) => <li key={entry}>{entry}</li>)}</ul>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
