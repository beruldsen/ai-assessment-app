"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Scenario = {
  id: string;
  name: string;
  role: string;
};

export default function SimulationStartPage() {
  const router = useRouter();
  const [scenarioId, setScenarioId] = useState("");
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/simulations/scenarios");
      const json = await res.json();
      if (!res.ok) {
        setStatus(`error: ${json.error ?? "failed to load scenarios"}`);
        return;
      }
      setScenarios(json.scenarios ?? []);
      if ((json.scenarios ?? []).length > 0) {
        setScenarioId(json.scenarios[0].id);
      }
    })();
  }, []);

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

    router.push(`/simulation/${json.attemptId}`);
  }

  return (
    <main style={{ padding: 24, maxWidth: 760, margin: "0 auto" }}>
      <h1>Start Simulation</h1>
      <p>Pick a scenario and start your role-play assessment.</p>

      {scenarios.length > 0 ? (
        <select
          value={scenarioId}
          onChange={(e) => setScenarioId(e.target.value)}
          style={{ width: "100%", padding: 10, marginTop: 8 }}
          disabled={busy}
        >
          {scenarios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.role})
            </option>
          ))}
        </select>
      ) : (
        <input
          value={scenarioId}
          onChange={(e) => setScenarioId(e.target.value)}
          placeholder="scenario uuid"
          style={{ width: "100%", padding: 10, marginTop: 8 }}
          disabled={busy}
        />
      )}

      <button onClick={startAttempt} disabled={busy || !scenarioId.trim()} style={{ marginTop: 12 }}>
        Start attempt
      </button>
      <p style={{ marginTop: 8 }}>{status}</p>
    </main>
  );
}
