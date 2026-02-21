"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SimulationStartPage() {
  const router = useRouter();
  const [scenarioId, setScenarioId] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function startAttempt() {
    if (!scenarioId.trim()) return;
    setBusy(true);
    setStatus("starting...");

    const res = await fetch("/api/simulations/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenarioId: scenarioId.trim() }),
    });

    const json = await res.json();
    if (!res.ok) {
      setStatus(`error: ${json.error ?? "failed"}`);
      setBusy(false);
      return;
    }

    setStatus("started");
    router.push(`/simulation/${json.attemptId}`);
  }

  return (
    <main style={{ padding: 24, maxWidth: 700 }}>
      <h1>Start Simulation</h1>
      <p>Paste a scenario id from Supabase and start a run.</p>
      <input
        value={scenarioId}
        onChange={(e) => setScenarioId(e.target.value)}
        placeholder="scenario uuid"
        style={{ width: "100%", padding: 10, marginTop: 8 }}
        disabled={busy}
      />
      <button onClick={startAttempt} disabled={busy || !scenarioId.trim()} style={{ marginTop: 12 }}>
        Start attempt
      </button>
      <p style={{ marginTop: 8 }}>{status}</p>
    </main>
  );
}
