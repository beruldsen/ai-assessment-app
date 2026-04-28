"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import InterviewRadarChart from "@/components/InterviewRadarChart";
import { capabilityShortLabel, toneClass } from "@/lib/interviewReportUi";

type InterviewScore = {
  id: string;
  capability: string;
  score: number;
};

type InterviewReport = {
  overallRating: string;
  overallAverage: number;
  executiveSummary: string[];
  topStrengths: string[];
  topDevelopmentPriorities: string[];
  capabilityBreakdown: Array<{
    capability: string;
    score: number;
    level: string;
    signalLabel: string;
    summary: string;
    strengths: string[];
    gaps: string[];
    nextStep: string;
  }>;
};

export default function InterviewPrintPage() {
  const params = useParams<{ interviewId: string }>();
  const interviewId = params?.interviewId;

  const [scores, setScores] = useState<InterviewScore[]>([]);
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [status, setStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!interviewId) return;
    try {
      const res = await fetch(`/api/interviews/${interviewId}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        setStatus(`error: ${json.error ?? "failed"}`);
        setErrorMessage(json.error ?? "Failed to load the report.");
        return;
      }
      setScores(json.scores ?? []);
      setReport(json.report ?? null);
      setStatus((json.scores ?? []).length ? "completed" : "pending");
      setErrorMessage(null);
    } catch {
      setStatus("error: failed");
      setErrorMessage("We could not load the report. Please refresh and try again.");
    }
  }, [interviewId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="page grid report-print-page">
      <div className="card surface-hero" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div>
          <h1 className="title" style={{ marginBottom: 4 }}>Sales Engineering Capability Assessment Report</h1>
          <p className="subtitle" style={{ marginBottom: 8 }}>Future Sales Engineer Assessment Centre</p>
          <span className="badge">Status: {status}</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/interview/${interviewId}/results`} className="button ghost" style={{ textDecoration: "none" }}>Back to web report</Link>
          <button className="button" onClick={() => window.print()}>Print / Save PDF</button>
        </div>
      </div>

      {scores.length === 0 || !report ? (
        <section className="card grid">
          <p className="meta">Scoring in progress or no report available yet.</p>
          {errorMessage ? <p className="meta" style={{ color: "#991b1b" }}>Error: {errorMessage}</p> : null}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="button" onClick={() => void load()}>Refresh report</button>
            <Link href={`/interview/${interviewId}/results`} className="button ghost" style={{ textDecoration: "none" }}>Back to web report</Link>
          </div>
        </section>
      ) : (
        <div className="report-print-safe">
          <section className="report-sheet report-sheet-premium">
            <div className="report-sheet-header">
              <div>
                <div className="report-sheet-title">Sales Engineering Capability Assessment</div>
                <div className="report-sheet-meta">Interview ID: {interviewId}</div>
              </div>
              <div className={`report-summary-pill ${toneClass(report.overallAverage)}`}>
                <div className="report-summary-pill-label">Overall rating</div>
                <div className="report-summary-pill-value">{report.overallRating}</div>
                <div className="report-summary-pill-sub">Average {report.overallAverage}/5</div>
              </div>
            </div>

            <div className="report-mini-block" style={{ marginTop: 0 }}>
              <strong>Executive summary</strong>
              <div className="report-bullet-list" style={{ marginTop: 8 }}>
                {report.executiveSummary.map((item) => (
                  <div key={item} className="report-bullet-item">• {item}</div>
                ))}
              </div>
            </div>

            <div className="report-radar-results-row" style={{ marginTop: 16 }}>
              <div className="report-mini-block report-radar-panel" style={{ marginTop: 0 }}>
                <strong>Capability radar</strong>
                <InterviewRadarChart scores={scores.map((score) => ({ capability: score.capability, score: score.score }))} printMode />
              </div>
              <div className="report-mini-block report-results-panel" style={{ marginTop: 0 }}>
                <strong>Assessment snapshot</strong>
                <div className={`report-summary-pill report-summary-pill-compact ${toneClass(report.overallAverage)}`} style={{ marginTop: 10 }}>
                  <div className="report-summary-pill-label">Overall rating</div>
                  <div className="report-summary-pill-value">{report.overallRating}</div>
                  <div className="report-summary-pill-sub">Average {report.overallAverage}/5</div>
                </div>
                <table className="report-results-table compact" style={{ marginTop: 12 }}>
                  <tbody>
                    {report.capabilityBreakdown.map((item) => (
                      <tr key={item.capability}>
                        <td>
                          <span className={`report-score-dot ${toneClass(item.score)}`} />
                          {capabilityShortLabel(item.capability)}
                        </td>
                        <td>{item.score}/5</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="report-grid-2" style={{ marginTop: 18 }}>
              <div>
                <h2>Key strengths</h2>
                <div className="report-bullet-list">
                  {report.topStrengths.map((item) => <div key={item} className="report-bullet-item score-strong">✓ {item}</div>)}
                </div>
              </div>
              <div>
                <h2>Key development priorities</h2>
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
                      <div className="meta">{item.signalLabel}</div>
                    </div>
                    <span className={`badge ${toneClass(item.score)}`}>{item.score}/5</span>
                  </div>
                  <div className="report-mini-block"><strong>Capability summary</strong><span>{item.summary}</span></div>
                  <div className="report-mini-grid">
                    <div>
                      <strong>Strengths demonstrated</strong>
                      <ul>{item.strengths.map((entry) => <li key={entry}>{entry}</li>)}</ul>
                    </div>
                    <div>
                      <strong>Development gaps</strong>
                      <ul>{item.gaps.map((entry) => <li key={entry}>{entry}</li>)}</ul>
                    </div>
                  </div>
                  <div className="report-mini-block"><strong>Practical next step</strong><span>{item.nextStep}</span></div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
