"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Scenario = { id: string; name: string; role: string };

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
      if (!res.ok) return setStatus(`error: ${json.error ?? "failed to load scenarios"}`);
      setScenarios(json.scenarios ?? []);
      if ((json.scenarios ?? []).length) setScenarioId(json.scenarios[0].id);
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
    <main className="page">
      <h1 className="title">Sales Simulation</h1>
      <p className="subtitle">Pick a presales scenario and start your buyer conversation.</p>

      <section className="card grid">
        <label>
          Scenario
          {scenarios.length > 0 ? (
            <select className="select" value={scenarioId} onChange={(e) => setScenarioId(e.target.value)} disabled={busy}>
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
              ))}
            </select>
          ) : (
            <input className="input" value={scenarioId} onChange={(e) => setScenarioId(e.target.value)} placeholder="scenario uuid" disabled={busy} />
          )}
        </label>
        <div>
          <button className="button" onClick={startAttempt} disabled={busy || !scenarioId.trim()}>Start simulation</button>
          {status ? <p className="meta" style={{ marginTop: 8 }}>{status}</p> : null}
        </div>
      </section>
    </main>
  );
}
