"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CAPABILITIES, type Capability } from "@/lib/capabilityFramework";

export default function InterviewStartPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<Capability[]>([...CAPABILITIES]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function toggle(capability: Capability) {
    setSelected((current) =>
      current.includes(capability)
        ? current.filter((item) => item !== capability)
        : [...current, capability]
    );
  }

  async function startInterview() {
    setBusy(true);
    setStatus("Preparing interview...");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/interviews/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ capabilities: selected }),
      });
      const json = await res.json();
      if (!res.ok) {
        setStatus(`error: ${json.error ?? "failed to start"}`);
        setErrorMessage(json.error ?? "We could not start the interview. Please try again.");
        setBusy(false);
        return;
      }
      router.push(`/interview/${json.interviewId}`);
    } catch {
      setStatus("error: failed to start");
      setErrorMessage("We could not start the interview. Please check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <main className="page grid">
      <div className="card surface-hero interview-hero">
        <div>
          <div className="eyebrow">Future Sales Engineer Assessment Centre</div>
          <h1 className="title">Sales Engineering Capability Assessment - AI Behavioural Based Interview</h1>
          <p className="subtitle">A structured behavioural interview designed to assess commercially relevant Sales Engineering capability through real examples, clear evidence, and practical judgement.</p>
        </div>
        <div className="interview-hero-meta">
          <span className="badge">Format: Guided interview</span>
          <span className="badge">Mode: Voice first, text fallback</span>
          <span className="badge">Coverage: 6 capability areas</span>
        </div>
      </div>

      <section className="card grid">
        <strong>Before you start</strong>
        <ul className="meta" style={{ margin: 0, paddingLeft: 18 }}>
          <li>Set aside focused time. This assessment is reflective rather than rushed.</li>
          <li>Come prepared with 2 to 3 specific customer or account situations.</li>
          <li>Use real examples and explain what you did, why you did it, who you influenced, and what changed.</li>
        </ul>
      </section>

      <section className="card grid">
        <strong>Select capability areas</strong>
        <div className="grid">
          {CAPABILITIES.map((capability) => (
            <label key={capability} style={{ display: "flex", gap: 8, alignItems: "start" }}>
              <input
                type="checkbox"
                checked={selected.includes(capability)}
                onChange={() => toggle(capability)}
                disabled={busy}
              />
              <span>{capability}</span>
            </label>
          ))}
        </div>

        <div className="grid" style={{ gap: 8 }}>
          {errorMessage ? <div className="meta" style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", padding: 12, borderRadius: 12, fontSize: 13 }}>Error: {errorMessage}</div> : null}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button className="button" onClick={startInterview} disabled={busy || selected.length === 0}>
              {busy ? "Preparing interview..." : "Start interview"}
            </button>
            <span className="meta">{selected.length} capability area{selected.length === 1 ? "" : "s"} selected</span>
          </div>
          {status ? <p className="meta" style={{ marginTop: 0 }}>{status}</p> : null}
        </div>
      </section>
    </main>
  );
}
