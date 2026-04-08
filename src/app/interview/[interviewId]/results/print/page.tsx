"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

type InterviewScore = {
  id: string;
  capability: string;
  score: number;
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

function radarPoint(idx: number, value: number, total: number, cx: number, cy: number, radius: number) {
  const angle = (Math.PI * 2 * idx) / total - Math.PI / 2;
  const r = (value / 5) * radius;
  return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r, angle };
}

function splitLabel(text: string, maxLineLength = 18, maxLines = 3) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxLineLength) {
      current = next;
      continue;
    }
    if (current) {
      lines.push(current);
      current = word;
    } else {
      lines.push(word.slice(0, maxLineLength));
      current = word.slice(maxLineLength);
    }
    if (lines.length >= maxLines - 1) break;
  }

  if (current && lines.length < maxLines) lines.push(current);
  return lines.slice(0, maxLines);
}

function labelAnchor(angle: number) {
  const normalized = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const cos = Math.cos(normalized);
  if (cos > 0.35) return "start";
  if (cos < -0.35) return "end";
  return "middle";
}

function RadarChart({ rows }: { rows: InterviewScore[] }) {
  if (!rows.length) return null;

  const size = 520;
  const cx = 260;
  const cy = 260;
  const radius = 150;
  const labelRadius = 182;

  const toPath = (vals: number[]) =>
    vals
      .map((v, i) => {
        const p = radarPoint(i, v, vals.length, cx, cy, radius);
        return `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      })
      .join(" ") + " Z";

  const vals = rows.map((r) => r.score ?? 0);

  return (
    <svg className="radar-svg" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {[1, 2, 3, 4, 5].map((lvl) => (
        <circle key={lvl} cx={cx} cy={cy} r={(lvl / 5) * radius} fill="none" stroke="#d1d5db" strokeWidth="1" />
      ))}
      {rows.map((r, i) => {
        const axis = radarPoint(i, 5, rows.length, cx, cy, radius);
        const label = radarPoint(i, 5, rows.length, cx, cy, labelRadius);
        const lines = splitLabel(r.capability);
        const anchor = labelAnchor(label.angle);
        const startDy = lines.length > 1 ? `${-((lines.length - 1) * 0.55)}em` : "0.35em";
        return (
          <g key={r.capability}>
            <line x1={cx} y1={cy} x2={axis.x} y2={axis.y} stroke="#d1d5db" strokeWidth="1" />
            <text x={label.x} y={label.y} textAnchor={anchor} fontSize="12" fontWeight="600" fill="#334155">
              {lines.map((line, idx) => (
                <tspan key={`${r.capability}-${idx}`} x={label.x} dy={idx === 0 ? startDy : "1.15em"}>
                  {line}
                </tspan>
              ))}
            </text>
          </g>
        );
      })}
      <path d={toPath(vals)} fill="rgba(79,70,229,0.20)" stroke="#4f46e5" strokeWidth="2.5" />
    </svg>
  );
}

export default function InterviewResultsPrintPage() {
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

  function handlePrint() {
    const originalTitle = document.title;
    document.title = `Behavioural_Interview_Report_${interviewId}.pdf`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 250);
  }

  return (
    <main className="page report-print-page">
      <section className="card surface-hero print-hide" style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <p className="meta" style={{ margin: 0 }}>Dedicated print/PDF view for the behavioural interview report.</p>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/interview/${interviewId}/results`} className="button ghost" style={{ textDecoration: "none" }}>Back to web report</Link>
          <button className="button" onClick={handlePrint}>Print / Save PDF</button>
        </div>
      </section>

      {!report || !scores.length ? (
        <section className="card">
          <h2 style={{ marginTop: 0 }}>Report not ready yet</h2>
          <p className="meta">{status || "Waiting for interview scoring."}</p>
        </section>
      ) : (
        <div className="report-print-safe">
          <section className="report-sheet">
            <div className="report-sheet-header">
              <div>
                <div className="report-sheet-title">AI Behavioural Interview Report</div>
                <div className="report-sheet-meta">Sales Engineering assessment report</div>
              </div>
              <div className="report-sheet-meta report-sheet-meta-right">
                <div>Interview ID: {interviewId}</div>
                <div>Overall rating: {report.overallRating}</div>
                <div>Overall average: {report.overallAverage}/5</div>
              </div>
            </div>

            <div className="report-sheet-section">
              <h2>Executive summary</h2>
              <div className="print-kpi-grid">
                <div className="print-kpi-box"><strong>Overall rating</strong><span>{report.overallRating}</span></div>
                <div className="print-kpi-box"><strong>Overall average</strong><span>{report.overallAverage}/5</span></div>
                <div className="print-kpi-box"><strong>Top strengths</strong><span>{report.topStrengths.slice(0, 2).join(" · ") || "-"}</span></div>
                <div className="print-kpi-box"><strong>Top priorities</strong><span>{report.topDevelopmentPriorities.slice(0, 2).join(" · ") || "-"}</span></div>
              </div>
              <div className="print-text-block" style={{ marginTop: 10 }}>
                <strong>Headline insight</strong>
                <div className="meta" style={{ marginTop: 4 }}>{report.headlineInsight}</div>
              </div>
            </div>
          </section>

          <section className="report-sheet">
            <div className="report-sheet-section">
              <h2>Capability overview</h2>
              <div className="print-radar-safe-grid">
                <div>
                  <RadarChart rows={scores} />
                  <p className="meta">Capability score snapshot, scale 1-5.</p>
                </div>
                <div className="print-legend-list">
                  {report.capabilityBreakdown.map((item) => (
                    <div key={item.capability} className="print-legend-item">
                      <strong>{item.capability}</strong>
                      <div className="meta">Score: {item.score}/5 · {item.level}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="report-sheet">
            <div className="report-sheet-section">
              <h2>Capability breakdown</h2>
              {report.capabilityBreakdown.map((item) => (
                <div key={item.capability} className="print-text-block">
                  <strong>{item.capability} · {item.score}/5 · {item.level}</strong>
                  <div className="meta" style={{ marginTop: 6 }}><strong>Behavioural evidence:</strong> {item.evidence}</div>
                  <div className="meta" style={{ marginTop: 6 }}><strong>Benchmark comparison:</strong> {item.benchmark}</div>
                  <div className="meta" style={{ marginTop: 6 }}><strong>Impact statement:</strong> {item.impactStatement}</div>
                  {item.strengths.length ? <div className="meta" style={{ marginTop: 6 }}><strong>Strengths:</strong> {item.strengths.join("; ")}</div> : null}
                  {item.gaps.length ? <div className="meta" style={{ marginTop: 6 }}><strong>Gaps vs high performance:</strong> {item.gaps.join("; ")}</div> : null}
                  {item.behaviouralPatterns.length ? <div className="meta" style={{ marginTop: 6 }}><strong>Patterns:</strong> {item.behaviouralPatterns.join("; ")}</div> : null}
                </div>
              ))}
            </div>
          </section>

          <section className="report-sheet">
            <div className="report-sheet-section">
              <h2>Strengths profile</h2>
              {report.strengthsProfile.map((item) => (
                <div key={item} className="print-text-block">{item}</div>
              ))}
            </div>
          </section>

          <section className="report-sheet">
            <div className="report-sheet-section">
              <h2>Development priorities and practical development plan</h2>
              {report.topDevelopmentPriorities.map((item) => (
                <div key={item} className="print-text-block">{item}</div>
              ))}
              <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginTop: 12 }}>
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
