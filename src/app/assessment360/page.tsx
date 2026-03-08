"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Cycle = {
  id: string;
  title: string;
  participant_name: string;
  status: "open" | "closed";
  created_at: string;
  my_role?: "self" | "manager" | "admin";
};

export default function Assessment360HomePage() {
  const router = useRouter();
  const [title, setTitle] = useState("Future-Ready SE 180");
  const [participantName, setParticipantName] = useState("");
  const [managerEmail, setManagerEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [cycles, setCycles] = useState<Cycle[]>([]);

  async function authHeaders() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function loadCycles() {
    const res = await fetch("/api/assessment360/cycles", { headers: await authHeaders() });
    const json = await res.json();
    if (!res.ok) return setStatus(`error: ${json.error ?? "failed to load cycles"}`);
    setCycles(json.cycles ?? []);
  }

  useEffect(() => {
    loadCycles();
  }, []);

  async function createCycle() {
    if (!title.trim() || !participantName.trim() || !managerEmail.trim()) return;
    setBusy(true);
    setStatus("creating...");

    const res = await fetch("/api/assessment360/cycles", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ title: title.trim(), participantName: participantName.trim(), managerEmail: managerEmail.trim() }),
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
      <h1 className="title">Future SE 180° Assessment</h1>
      <p className="subtitle">Self + manager ratings, based on 7 capability areas and observable behaviours.</p>

      <section className="card grid" style={{ marginBottom: 14 }}>
        <label>
          Cycle title
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy} />
        </label>
        <label>
          Participant name
          <input className="input" value={participantName} onChange={(e) => setParticipantName(e.target.value)} placeholder="e.g. Alex Johnson" disabled={busy} />
        </label>
        <label>
          Manager email
          <input className="input" value={managerEmail} onChange={(e) => setManagerEmail(e.target.value)} placeholder="manager@company.com" disabled={busy} />
        </label>
        <div>
          <button className="button" onClick={createCycle} disabled={busy || !title.trim() || !participantName.trim() || !managerEmail.trim()}>
            Create cycle
          </button>
          {status ? <p className="meta" style={{ marginTop: 8 }}>{status}</p> : null}
        </div>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>My cycles</h2>
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
                <div className="meta">{c.participant_name} · {new Date(c.created_at).toLocaleString()} · role: {c.my_role ?? "-"}</div>
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
