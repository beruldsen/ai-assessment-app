"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CAPABILITIES, type Capability } from "@/lib/capabilityFramework";

export default function InterviewStartPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<Capability[]>([...CAPABILITIES]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  function toggle(capability: Capability) {
    setSelected((current) =>
      current.includes(capability)
        ? current.filter((item) => item !== capability)
        : [...current, capability]
    );
  }

  async function startInterview() {
    setBusy(true);
    setStatus("starting...");
    const res = await fetch("/api/interviews/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ capabilities: selected }),
    });
    const json = await res.json();
    if (!res.ok) {
      setStatus(`error: ${json.error ?? "failed to start"}`);
      setBusy(false);
      return;
    }
    router.push(`/interview/${json.interviewId}`);
  }

  return (
    <main className="page grid">
      <div>
        <h1 className="title">AI Behavioural Interview</h1>
        <p className="subtitle">Launch the integrated behavioural interview module using the same capability framework as the 180 and simulation assessments.</p>
      </div>

      <section className="card grid">
        <strong>Before you start</strong>
        <ul className="meta" style={{ margin: 0, paddingLeft: 18 }}>
          <li>Set aside focused time. This interview is thoughtful rather than fast.</li>
          <li>Come with 2 to 3 specific customer situations in mind.</li>
          <li>Use real examples and explain what you did, why you did it, and what changed.</li>
        </ul>
      </section>

      <section className="card grid">
        <strong>Select capabilities</strong>
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

        <div>
          <button className="button" onClick={startInterview} disabled={busy || selected.length === 0}>
            Start interview
          </button>
          {status ? <p className="meta" style={{ marginTop: 8 }}>{status}</p> : null}
        </div>
      </section>
    </main>
  );
}
