"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import InterviewRadarChart from "@/components/InterviewRadarChart";
import { toneClass, toneLabel } from "@/lib/interviewReportUi";

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

type InterviewJob = {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  last_error?: string | null;
  error?: string | null;
  attempts?: number | null;
};

export default function InterviewResultsPage() {
  const params = useParams<{ interviewId: string }>();
  const interviewId = params?.interviewId;

  const [scores, setScores] = useState<InterviewScore[]>([]);
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [status, setStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [job, setJob] = useState<InterviewJob | null>(null);

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
      const nextScores = json.scores ?? [];
      const nextReport = json.report ?? null;
      const nextJob = json.job ?? null;
      setScores(nextScores);
      setReport(nextReport);
      setJob(nextJob);
      if (nextScores.length) {
        setStatus("completed");
        setErrorMessage(null);
      } else if (nextJob?.status === "failed") {
        setStatus("failed");
        setErrorMessage(nextJob.last_error ?? nextJob.error ?? "Report generation failed.");
      } else if (nextJob?.status === "running") {
        setStatus("running");
        setErrorMessage(null);
      } else {
        setStatus("pending");
        setErrorMessage(null);
      }
    } catch {
      setStatus("error: failed");
      setErrorMessage("We could not load the report. Please refresh and try again.");
    }
  }, [interviewId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!["pending", "running"].includes(status)) return;
    const t = setInterval(() => void load(), 2500);
    return () => clearInterval(t);
  }, [status, load]);

  const strongest = useMemo(() => [...scores].sort((a, b) => b.score - a.score)[0], [scores]);
  const weakest = useMemo(() => [...scores].sort((a, b) => a.score - b.score)[0], [scores]);

  return (
    <main className="page grid report-page-shell report-print-page">
      <div className="card surface-hero report-hero">
        <div>
          <div className="eyebrow">Future Sales Engineer Assessment Centre</div>
          <h1 className="title" style={{ marginBottom: 6 }}>Sales Engineering Capability Assessment Report</h1>
          <div className="report-chip-row">
            <span className="badge">Interview ID: {interviewId}</span>
            <span className={`badge ${toneClass(report?.overallAverage ?? 3)}`}>Status: {status}</span>
            {job ? <span className="badge">Job: {job.status}</span> : null}
            {report ? <span className={`badge ${toneClass(report.overallAverage)}`}>Overall signal: {toneLabel(report.overallAverage)}</span> : null}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href={`/interview/${interviewId}`} className="button ghost" style={{ textDecoration: "none" }}>Back to interview</Link>
          <Link href={`/interview/${interviewId}/results/print`} className="button" style={{ textDecoration: "none" }}>Open print / PDF view</Link>
        </div>
      </div>

      {scores.length === 0 || !report ? (
        <section className="card grid">
          <p className="meta">{status === "failed" ? "Report generation failed." : "Scoring is still in progress or the report is not ready yet."}</p>
          {job?.id ? <p className="meta">Scoring job: {job.id}{job.attempts ? `, attempts: ${job.attempts}` : ""}</p> : null}
          {errorMessage ? <p className="meta" style={{ color: "#991b1b" }}>Error: {errorMessage}</p> : null}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="button" onClick={() => void load()}>Refresh report</button>
            <Link href={`/interview/${interviewId}`} className="button ghost" style={{ textDecoration: "none" }}>Back to interview</Link>
          </div>
        </section>
      ) : (
        <div className="report-print-safe report-stack-lg">
          <section className="report-sheet report-sheet-premium">
            <div className="report-sheet-header report-grid-2">
              <div>
                <div className="report-sheet-title">Executive summary</div>
                <div className="report-sheet-meta">A high-level view of current Sales Engineering capability, highlighting strengths, inconsistencies, and the most important development priorities.</div>
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
                <div className="report-kpi-label">Highest priority gap</div>
                <div className="report-kpi-value report-kpi-small">{weakest?.capability ?? "-"}</div>
                <div className="report-kpi-sub">{weakest ? `${weakest.score}/5` : ""}</div>
              </div>
            </div>

            <div className="report-bullet-list" style={{ marginTop: 14 }}>
              {report.executiveSummary.map((item) => (
                <div key={item} className="report-bullet-item">• {item}</div>
              ))}
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
                <div className="report-sheet-title">Cross-capability view</div>
                <div className="report-section-block">
                  <h3>Key strengths</h3>
                  <div className="report-bullet-list">
                    {report.topStrengths.map((item) => (
                      <div key={item} className="report-bullet-item score-strong">✓ {item}</div>
                    ))}
                  </div>
                </div>
                <div className="report-section-block">
                  <h3>Key development priorities</h3>
                  <div className="report-bullet-list">
                    {report.topDevelopmentPriorities.map((item) => (
                      <div key={item} className="report-bullet-item score-low">→ {item}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="report-sheet report-sheet-premium">
            <div className="report-sheet-section">
              <h2>Capability breakdown</h2>
              <div className="report-sheet-meta" style={{ marginBottom: 12 }}>Detailed view of behavioural evidence, development gaps, and practical next steps for each assessed capability.</div>
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

                    <div className="report-mini-block">
                      <strong>Capability summary</strong>
                      <span>{item.summary}</span>
                    </div>

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

                    <div className="report-mini-block">
                      <strong>Practical next step</strong>
                      <span>{item.nextStep}</span>
                    </div>
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
