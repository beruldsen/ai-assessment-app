"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CAPABILITIES, type Capability } from "@/lib/capabilityFramework";

export default function RealtimeInterviewStartPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<Capability[]>([...CAPABILITIES]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCountLabel = useMemo(
    () => `${selected.length} capability area${selected.length === 1 ? "" : "s"} selected`,
    [selected.length]
  );

  function toggle(capability: Capability) {
    setSelected((current) =>
      current.includes(capability)
        ? current.filter((item) => item !== capability)
        : [...current, capability]
    );
  }

  async function startInterview() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/interviews/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ capabilities: selected }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "We could not start the realtime interview.");
        setBusy(false);
        return;
      }
      router.push(`/interview/realtime/${json.interviewId}`);
    } catch {
      setError("We could not start the realtime interview. Please try again.");
      setBusy(false);
    }
  }

  return (
    <main className="page grid">
      <div className="card surface-hero interview-hero">
        <div>
          <div className="eyebrow">Prototype voice mode</div>
          <h1 className="title">Realtime Behavioural Interview Prototype</h1>
          <p className="subtitle">This is a more natural live voice prototype layered onto the same behavioural interview engine. It is for evaluation, not yet the production-default interview path.</p>
        </div>
        <div className="interview-hero-meta">
          <span className="badge">Format: Live conversational voice</span>
          <span className="badge">Status: Prototype</span>
          <span className="badge">Fallback: Existing structured interview remains available</span>
        </div>
      </div>

      <section className="card grid">
        <strong>What this prototype does</strong>
        <ul className="meta" style={{ margin: 0, paddingLeft: 18 }}>
          <li>Keeps the same interview state, capability progression, and stored transcript.</li>
          <li>Uses realtime voice for a more fluid interviewer experience.</li>
          <li>Lets you compare the live voice feel against the current push-to-talk flow.</li>
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
          {error ? <div className="meta" style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", padding: 12, borderRadius: 12, fontSize: 13 }}>Error: {error}</div> : null}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button className="button" onClick={startInterview} disabled={busy || selected.length === 0}>
              {busy ? "Preparing realtime interview..." : "Start realtime interview"}
            </button>
            <span className="meta">{selectedCountLabel}</span>
          </div>
        </div>
      </section>
    </main>
  );
}
