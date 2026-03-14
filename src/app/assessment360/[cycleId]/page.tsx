"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ASSESSMENT_180_CAPABILITIES, ASSESSMENT_360_QUESTIONS, type RaterType } from "@/lib/assessment360";

type SubmissionState = {
  rater_type: RaterType;
  status: "draft" | "final_submitted";
  submitted_at: string | null;
  version: number;
};

type ApiResponse = {
  viewerRole: "self" | "manager" | "admin" | null;
  cycle: {
    id: string;
    title: string;
    participant_name: string;
    status: string;
    created_at: string;
  };
  responses: Array<{
    rater_type: RaterType;
    question_id: string;
    dimension: string;
    question_text: string;
    score: number;
    comment: string | null;
  }>;
  submissions: SubmissionState[];
  actionPlan: {
    strengths: string | null;
    priorities: string | null;
    plan_30: string | null;
    plan_60: string | null;
    plan_90: string | null;
    updated_at: string;
  } | null;
};

export default function Assessment360CyclePage() {
  const params = useParams<{ cycleId: string }>();
  const cycleId = String(params.cycleId ?? "");

  const [tab, setTab] = useState<RaterType>("self");
  const [currentStep, setCurrentStep] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [status, setStatus] = useState("loading...");
  const [saving, setSaving] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);

  const [scores, setScores] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [strengthsText, setStrengthsText] = useState("");
  const [prioritiesText, setPrioritiesText] = useState("");
  const [plan30, setPlan30] = useState("");
  const [plan60, setPlan60] = useState("");
  const [plan90, setPlan90] = useState("");

  const totalSteps = ASSESSMENT_180_CAPABILITIES.length;
  const currentCapability = ASSESSMENT_180_CAPABILITIES[currentStep];
  const currentQuestion = ASSESSMENT_360_QUESTIONS.find((q) => q.id === currentCapability?.id);
  const prevTabRef = useRef<RaterType>(tab);

  async function authHeaders() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function load() {
    setStatus("loading...");
    const res = await fetch(`/api/assessment360/cycles/${cycleId}`, { headers: await authHeaders() });
    const json = (await res.json()) as ApiResponse | { error: string };
    if (!res.ok) {
      const message = "error" in json ? json.error : "failed";
      setStatus(`error: ${message}`);
      return;
    }

    const payload = json as ApiResponse;
    setData(payload);
    setStrengthsText(payload.actionPlan?.strengths ?? "");
    setPrioritiesText(payload.actionPlan?.priorities ?? "");
    setPlan30(payload.actionPlan?.plan_30 ?? "");
    setPlan60(payload.actionPlan?.plan_60 ?? "");
    setPlan90(payload.actionPlan?.plan_90 ?? "");
    setStatus("");
  }

  useEffect(() => {
    if (!cycleId) return;
    load();
  }, [cycleId]);

  useEffect(() => {
    if (!data) return;
    const filtered = data.responses.filter((r) => r.rater_type === tab);
    const nextScores: Record<string, number> = {};
    const nextComments: Record<string, string> = {};
    for (const r of filtered) {
      nextScores[r.question_id] = r.score;
      nextComments[r.question_id] = r.comment ?? "";
    }
    setScores(nextScores);
    setComments(nextComments);

    const tabChanged = prevTabRef.current !== tab;
    if (tabChanged) {
      setCurrentStep(0);
      setCompleted(false);
      prevTabRef.current = tab;
    }
  }, [tab, data]);

  const currentSubmission = useMemo(() => data?.submissions.find((s) => s.rater_type === tab) ?? null, [data, tab]);
  const isFinalized = currentSubmission?.status === "final_submitted";

  const completion = useMemo(() => {
    const done = ASSESSMENT_360_QUESTIONS.filter((q) => Number(scores[q.id]) >= 1 && Number(scores[q.id]) <= 5).length;
    return { done, total: ASSESSMENT_360_QUESTIONS.length, percent: Math.round((done / ASSESSMENT_360_QUESTIONS.length) * 100) };
  }, [scores]);

  async function persistAnswers(mode: "draft" | "final") {
    const answers = ASSESSMENT_360_QUESTIONS
      .map((q) => ({ questionId: q.id, score: Number(scores[q.id]), comment: comments[q.id] ?? "" }))
      .filter((a) => Number.isFinite(a.score) && a.score >= 1 && a.score <= 5);

    if (answers.length === 0) return { ok: false, message: "Please score at least one capability before saving." };

    const res = await fetch(`/api/assessment360/cycles/${cycleId}/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ raterType: tab, answers, mode }),
    });

    const json = await res.json();
    if (!res.ok) return { ok: false, message: `error: ${json.error ?? "failed"}` };
    await load();
    return { ok: true, message: mode === "final" ? `Assessment completed for ${tab}.` : `Saved ${currentCapability?.capability}.` };
  }

  async function saveAndNext() {
    if (!currentQuestion) return;
    if (isFinalized) return;

    const currentScore = Number(scores[currentQuestion.id]);
    if (!(currentScore >= 1 && currentScore <= 5)) {
      setStatus("Please select a score before continuing.");
      return;
    }

    const lastStep = currentStep === totalSteps - 1;
    const previousStep = currentStep;
    if (!lastStep) {
      setCurrentStep(Math.min(currentStep + 1, totalSteps - 1));
    }

    setSaving(true);
    const result = await persistAnswers(lastStep ? "final" : "draft");
    setSaving(false);

    if (!result.ok) {
      if (!lastStep) setCurrentStep(previousStep);
      setStatus(result.message);
      return;
    }

    if (lastStep) {
      setCompleted(true);
      setStatus("Assessment completed. All capability scores are saved and ready for reporting.");
      return;
    }

    setStatus("");
  }

  function goPrev() {
    setCurrentStep((s) => Math.max(s - 1, 0));
  }

  async function reopenFinal() {
    const answers = ASSESSMENT_360_QUESTIONS
      .map((q) => ({ questionId: q.id, score: Number(scores[q.id]), comment: comments[q.id] ?? "" }))
      .filter((a) => Number.isFinite(a.score) && a.score >= 1 && a.score <= 5);

    const res = await fetch(`/api/assessment360/cycles/${cycleId}/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ raterType: tab, answers, mode: "draft", forceEditAfterFinal: true }),
    });

    const json = await res.json();
    if (!res.ok) return setStatus(`error: ${json.error ?? "failed"}`);
    await load();
    setCompleted(false);
    setStatus(`${tab} reopened to draft.`);
  }

  async function saveActionPlan() {
    setSavingPlan(true);
    const res = await fetch(`/api/assessment360/cycles/${cycleId}/action-plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ strengths: strengthsText, priorities: prioritiesText, plan30, plan60, plan90 }),
    });
    const json = await res.json();
    setSavingPlan(false);
    if (!res.ok) return setStatus(`error: ${json.error ?? "failed to save action plan"}`);
    setStatus("Saved development action plan.");
    await load();
  }

  return (
    <main className="page">
      <h1 className="title">Future SE 180° Assessment Cycle</h1>
      <p className="subtitle">{data ? `${data.cycle.title} · ${data.cycle.participant_name}` : "Loading..."}</p>

      <section className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <div className="progress" style={{ marginBottom: 10 }}>
            <button className={`step ${tab === "self" ? "active" : ""}`} onClick={() => setTab("self")}>Self</button>
            <button className={`step ${tab === "manager" ? "active" : ""}`} onClick={() => setTab("manager")}>Manager</button>
          </div>
          <Link href={`/assessment360/${cycleId}/report`} className="button ghost" style={{ textDecoration: "none" }}>Open report page</Link>
        </div>

        <p className="meta">Your role: {data?.viewerRole ?? "unknown"}</p>
        <p className="meta">{tab.toUpperCase()} completion: {completion.done}/{completion.total} · status: {currentSubmission?.status ?? "not started"}</p>

        <div style={{ marginTop: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span className="meta">Step {currentStep + 1} of {totalSteps}</span>
            <span className="meta">{completion.percent}% complete</span>
          </div>
          <div className="scoreBar"><span style={{ width: `${completion.percent}%` }} /></div>
        </div>
      </section>

      {completed || isFinalized ? (
        <section className="card wizard-card" style={{ marginBottom: 12 }}>
          <h2 style={{ marginTop: 0 }}>Assessment Completed ✅</h2>
          <p className="meta">All capability scores for <strong>{tab}</strong> are saved and ready for reporting.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <Link href={`/assessment360/${cycleId}/report`} className="button" style={{ textDecoration: "none" }}>Open report</Link>
            <button className="button ghost" onClick={() => { setCompleted(false); setCurrentStep(totalSteps - 1); }}>Review answers</button>
            {isFinalized ? <button className="button ghost" onClick={reopenFinal}>Reopen assessment</button> : null}
          </div>
        </section>
      ) : (
        <section className="card wizard-card" style={{ marginBottom: 12 }} key={`${tab}-${currentCapability?.id}`}>
          {currentCapability && currentQuestion ? (
            <>
              <h2 style={{ marginTop: 0 }}>{currentStep + 1}. {currentCapability.capability}</h2>
              <ul className="meta" style={{ marginTop: 0, marginBottom: 12, paddingLeft: 18 }}>
                {currentCapability.behaviors.map((b, i) => <li key={`${currentCapability.id}-${i}`} style={{ marginBottom: 4 }}>{b}</li>)}
              </ul>

              <div style={{ display: "grid", gap: 8 }}>
                <select
                  className="select"
                  value={scores[currentQuestion.id] ?? ""}
                  disabled={isFinalized}
                  onChange={(e) => setScores((s) => ({ ...s, [currentQuestion.id]: Number(e.target.value) }))}
                >
                  <option value="">Score (1-5)</option>
                  <option value="1">1 - Rarely demonstrated</option>
                  <option value="2">2 - Occasionally demonstrated</option>
                  <option value="3">3 - Consistently demonstrated</option>
                  <option value="4">4 - Strong capability / frequently demonstrated</option>
                  <option value="5">5 - Role model / consistently drives impact</option>
                </select>

                <input
                  className="input"
                  value={comments[currentQuestion.id] ?? ""}
                  disabled={isFinalized}
                  onChange={(e) => setComments((c) => ({ ...c, [currentQuestion.id]: e.target.value }))}
                  placeholder="Optional evidence comment"
                />
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="button ghost" onClick={goPrev} disabled={currentStep === 0 || saving}>Back</button>
                <button className="button" onClick={saveAndNext} disabled={saving || isFinalized}>
                  {currentStep === totalSteps - 1 ? "Complete assessment" : "Submit score and next"}
                </button>
              </div>
            </>
          ) : (
            <p className="meta">Loading capability...</p>
          )}
        </section>
      )}

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Development action plan (30/60/90)</h2>
        <div className="grid" style={{ gap: 8 }}>
          <input className="input" value={strengthsText} onChange={(e) => setStrengthsText(e.target.value)} placeholder="Top 2 strengths" />
          <input className="input" value={prioritiesText} onChange={(e) => setPrioritiesText(e.target.value)} placeholder="Top 2 development priorities" />
          <textarea className="input" value={plan30} onChange={(e) => setPlan30(e.target.value)} placeholder="30-day actions" rows={3} />
          <textarea className="input" value={plan60} onChange={(e) => setPlan60(e.target.value)} placeholder="60-day actions" rows={3} />
          <textarea className="input" value={plan90} onChange={(e) => setPlan90(e.target.value)} placeholder="90-day actions" rows={3} />
          <button className="button" onClick={saveActionPlan} disabled={savingPlan}>{savingPlan ? "Saving..." : "Save action plan"}</button>
        </div>
      </section>

      {status ? <p className="meta" style={{ marginTop: 10 }}>{status}</p> : null}
    </main>
  );
}
