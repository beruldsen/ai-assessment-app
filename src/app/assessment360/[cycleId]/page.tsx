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
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const totalSteps = ASSESSMENT_180_CAPABILITIES.length;
  const currentCapability = ASSESSMENT_180_CAPABILITIES[currentStep];
  const currentQuestion = ASSESSMENT_360_QUESTIONS.find((q) => q.id === currentCapability?.id);
  const prevTabRef = useRef<RaterType>(tab);
  const loadRequestRef = useRef(0);

  async function authHeaders(): Promise<Record<string, string>> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }

  async function load() {
    const requestId = ++loadRequestRef.current;
    setStatus("loading...");
    const res = await fetch(`/api/assessment360/cycles/${cycleId}`, { headers: await authHeaders() });
    const json = (await res.json()) as ApiResponse | { error: string };

    // Ignore stale responses arriving out of order.
    if (requestId !== loadRequestRef.current) return;

    if (!res.ok) {
      const message = "error" in json ? json.error : "failed";
      setStatus(`error: ${message}`);
      return;
    }

    const payload = json as ApiResponse;
    setData(payload);
    setStatus("");
  }

  useEffect(() => {
    if (!cycleId) return;
    load();
  }, [cycleId]);

  useEffect(() => {
    if (!data) return;

    const role = data.viewerRole;
    if (role === "self" && tab !== "self") {
      setTab("self");
      return;
    }
    if (role === "manager" && tab !== "manager") {
      setTab("manager");
      return;
    }

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

  const availableTabs = useMemo(() => {
    if (data?.viewerRole === "self") return ["self"] as RaterType[];
    if (data?.viewerRole === "manager") return ["manager"] as RaterType[];
    return ["self", "manager"] as RaterType[];
  }, [data?.viewerRole]);

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

    const submitOnce = async () => {
      const res = await fetch(`/api/assessment360/cycles/${cycleId}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ raterType: tab, answers, mode }),
      });
      const json = await res.json();
      return { res, json };
    };

    let attempt = await submitOnce();
    // Small retry for transient server/network issues.
    if (!attempt.res.ok && attempt.res.status >= 500) {
      attempt = await submitOnce();
    }

    if (!attempt.res.ok) return { ok: false, message: `error: ${attempt.json.error ?? "failed"}` };
    const savedAt = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setLastSavedAt(savedAt);
    await load();
    return { ok: true, message: mode === "final" ? `Assessment completed for ${tab}.` : `Saved ${currentCapability?.capability} at ${savedAt}.` };
  }

  async function saveAndNext() {
    if (!currentQuestion) return;
    if (isFinalized || saving) return;

    setErrorBanner(null);

    const currentScore = Number(scores[currentQuestion.id]);
    if (!(currentScore >= 1 && currentScore <= 5)) {
      setStatus("Please select a score before continuing.");
      return;
    }

    const currentComment = (comments[currentQuestion.id] ?? "").trim();
    if ((currentScore <= 2 || currentScore >= 4) && currentComment.length < 8) {
      setStatus("For very high or low scores, please add a brief evidence comment before continuing.");
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
      setErrorBanner(result.message);
      return;
    }

    if (lastStep) {
      setCompleted(true);
      setErrorBanner(null);
      setStatus("Assessment completed. All capability scores are saved and ready for reporting.");
      return;
    }

    setErrorBanner(null);
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

  return (
    <main className="page">
      <h1 className="title">Future SE 180° Assessment Cycle</h1>
      <p className="subtitle">{data ? `${data.cycle.title} · ${data.cycle.participant_name}` : "Loading..."}</p>

      <section className="card surface-hero" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <p className="meta" style={{ margin: "0 0 6px 0" }}>
              {data?.viewerRole === "admin" ? "Admin mode: testing both perspectives" : `Assessment perspective: ${tab === "self" ? "Self reflection" : "Manager feedback"}`}
            </p>
            <div className="progress" style={{ marginBottom: 10 }}>
              {availableTabs.map((roleTab) => (
                <button
                  key={roleTab}
                  className={`step ${tab === roleTab ? "active" : ""}`}
                  onClick={() => setTab(roleTab)}
                  disabled={saving}
                >
                  {roleTab === "self" ? "Self" : "Manager"}
                </button>
              ))}
            </div>
          </div>
          <Link href={`/assessment360/${cycleId}/report`} className="button ghost" style={{ textDecoration: "none" }}>Open report page</Link>
        </div>

        <p className="meta">Your role: {data?.viewerRole ?? "unknown"}</p>
        {data?.viewerRole === "admin" ? <span className="badge">Admin test mode</span> : null}
        {data?.viewerRole == null ? (
          <p className="meta" style={{ color: "#b45309", marginTop: 6 }}>
            Role not resolved for this link yet. Open the cycle from /assessment360 list or use a participant invite link.
          </p>
        ) : null}
        <p className="meta">{tab.toUpperCase()} completion: {completion.done}/{completion.total} · status: {currentSubmission?.status ?? "not started"}</p>
        {lastSavedAt ? <p className="meta">Draft last saved at {lastSavedAt}</p> : null}

        <div className="stepDots">
          {ASSESSMENT_180_CAPABILITIES.map((c, i) => {
            const scored = Number(scores[c.id]) >= 1 && Number(scores[c.id]) <= 5;
            const cls = i === currentStep ? "stepDot active" : scored ? "stepDot done" : "stepDot";
            return <span key={c.id} className={cls}>{i + 1}</span>;
          })}
        </div>

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

              <div style={{ background: "#f8fafc", border: "1px solid var(--border)", borderRadius: 10, padding: 10, marginBottom: 10 }}>
                <p className="meta" style={{ margin: 0 }}>
                  Development-focused guidance: rate based on observed behaviours over the last 3–6 months. Prioritise honest reflection and specific examples over perfection.
                </p>
              </div>

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
                  {saving ? "Saving..." : currentStep === totalSteps - 1 ? "Complete assessment" : "Submit score and next"}
                </button>
              </div>
            </>
          ) : (
            <p className="meta">Loading capability...</p>
          )}
        </section>
      )}

      {errorBanner ? (
        <p className="meta" style={{ marginTop: 10, color: "#b91c1c", fontWeight: 600 }}>
          Save issue: {errorBanner}
        </p>
      ) : null}
      {status ? <p className="meta" style={{ marginTop: 10 }}>{status}</p> : null}
    </main>
  );
}
