"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewSimulationPage() {
  const router = useRouter();
  const [scenarioId, setScenarioId] = useState("");
  const [orgId, setOrgId] = useState("");
  const [userId, setUserId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    setError("");

    const res = await fetch("/api/simulations/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scenarioId: scenarioId.trim(),
        orgId: orgId.trim() || null,
        userId: userId.trim() || null,
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Failed to start simulation");
      setBusy(false);
      return;
    }

    router.push(`/simulations/${json.attemptId}`);
  }

  return (
    <main style={{ padding: 24, maxWidth: 680 }}>
      <h1>Start Simulation</h1>
      <p>Paste your scenario id from Supabase.</p>

      <input
        value={scenarioId}
        onChange={(e) => setScenarioId(e.target.value)}
        placeholder="scenario uuid"
        style={{ width: "100%", padding: 10, marginTop: 8 }}
      />

      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
        <input
          value={orgId}
          onChange={(e) => setOrgId(e.target.value)}
          placeholder="orgId (optional)"
          style={{ flex: 1, padding: 10 }}
        />
        <input
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="userId (optional)"
          style={{ flex: 1, padding: 10 }}
        />
      </div>

      <button onClick={start} disabled={busy || !scenarioId.trim()} style={{ marginTop: 12, padding: 10 }}>
        {busy ? "Starting..." : "Start attempt"}
      </button>

      {error && <p style={{ color: "crimson", marginTop: 8 }}>{error}</p>}
    </main>
  );
}
