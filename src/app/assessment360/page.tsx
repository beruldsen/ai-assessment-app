"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Cycle = {
  id: string;
  title: string;
  participant_name: string;
  status: "open" | "closed";
  created_at: string;
};

export default function Assessment360HomePage() {
  const router = useRouter();
  const [title, setTitle] = useState("Future-Ready SE 360");
  const [participantName, setParticipantName] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [cycles, setCycles] = useState<Cycle[]>([]);

  async function loadCycles() {
    const res = await fetch("/api/assessment360/cycles");
    const json = await res.json();
    if (!res.ok) return setStatus(`error: ${json.error ?? "failed to load cycles"}`);
    setCycles(json.cycles ?? []);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCycles();
  }, []);

  async function createCycle() {
    if (!title.trim() || !participantName.trim()) return;
    setBusy(true);
    setStatus("creating...");

    const res = await fetch("/api/assessment360/cycles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), participantName: participantName.trim() }),
    });

    const json = await res.json();
    if (!res.ok) {
      setStatus(`error: ${json.error ?? "failed to create cycle"}`);
      setBusy(false);
      return;
    }

    router.push(`/assessment360/${json.cycleId}`);
  }

  return (
    <main className="page">
      <h1 className="title">Future SE 180° Assessment (MVP)</h1>
      <p className="subtitle">Self + manager ratings, based on 8 capability areas and observable behaviours.</p>

      <section className="card grid" style={{ marginBottom: 14 }}>
        <label>
          Cycle title
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy} />
        </label>
        <label>
          Participant name
          <input className="input" value={participantName} onChange={(e) => setParticipantName(e.target.value)} placeholder="e.g. Alex Johnson" disabled={busy} />
        </label>
        <div>
          <button className="button" onClick={createCycle} disabled={busy || !title.trim() || !participantName.trim()}>
            Create cycle
          </button>
          {status ? <p className="meta" style={{ marginTop: 8 }}>{status}</p> : null}
        </div>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Recent cycles</h2>
        {cycles.length === 0 ? (
          <p className="meta">No cycles yet.</p>
        ) : (
          <div className="grid">
            {cycles.map((c) => (
              <button
                key={c.id}
                className="button ghost"
                style={{ textAlign: "left" }}
                onClick={() => router.push(`/assessment360/${c.id}`)}
              >
                <strong>{c.title}</strong>
                <div className="meta">{c.participant_name} · {new Date(c.created_at).toLocaleString()}</div>
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
