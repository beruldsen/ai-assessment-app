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
  assessment360_cycle_participants?: Array<{
    role: "self" | "manager" | "admin";
    email: string;
    name: string;
    invite_status: "pending" | "sent" | "failed";
    invite_sent_at: string | null;
  }>;
};

export default function Assessment360HomePage() {
  const router = useRouter();
  const [title, setTitle] = useState("Future-Ready SE 180");
  const [selfName, setSelfName] = useState("");
  const [selfEmail, setSelfEmail] = useState("");
  const [managerName, setManagerName] = useState("");
  const [managerEmail, setManagerEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

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
    setIsAdmin(Boolean(json.isAdmin));
  }

  useEffect(() => {
    loadCycles();
  }, []);

  async function createCycleAsAdmin() {
    if (!title.trim() || !selfName.trim() || !selfEmail.trim() || !managerName.trim() || !managerEmail.trim()) return;
    setBusy(true);
    setStatus("creating + sending links...");

    const res = await fetch("/api/assessment360/cycles", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ title: title.trim(), selfName: selfName.trim(), selfEmail: selfEmail.trim(), managerName: managerName.trim(), managerEmail: managerEmail.trim() }),
    });

    const json = await res.json();
    if (!res.ok) {
      setStatus(`error: ${json.error ?? "failed to create cycle"}`);
      setBusy(false);
      return;
    }

    const inviteSummary = (json.invites ?? []).map((x: { role: string; invite_status: string }) => `${x.role}: ${x.invite_status}`).join(" · ");
    setStatus(`Created. Invite status -> ${inviteSummary}`);
    setBusy(false);
    await loadCycles();
    router.push(`/assessment360/${json.cycleId}`);
  }

  return (
    <main className="page">
      <h1 className="title">Future SE 180° Assessment</h1>
      <p className="subtitle">Admin-managed self + manager assignments with invite/link tracking.</p>

      {isAdmin ? (
        <section className="card grid" style={{ marginBottom: 14 }}>
          <label>
            Cycle title
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy} />
          </label>
          <label>
            Self participant name
            <input className="input" value={selfName} onChange={(e) => setSelfName(e.target.value)} placeholder="e.g. Alex Johnson" disabled={busy} />
          </label>
          <label>
            Self participant email
            <input className="input" value={selfEmail} onChange={(e) => setSelfEmail(e.target.value)} placeholder="alex@company.com" disabled={busy} />
          </label>
          <label>
            Manager name
            <input className="input" value={managerName} onChange={(e) => setManagerName(e.target.value)} placeholder="e.g. Priya Manager" disabled={busy} />
          </label>
          <label>
            Manager email
            <input className="input" value={managerEmail} onChange={(e) => setManagerEmail(e.target.value)} placeholder="manager@company.com" disabled={busy} />
          </label>
          <div>
            <button className="button" onClick={createCycleAsAdmin} disabled={busy || !title.trim() || !selfName.trim() || !selfEmail.trim() || !managerName.trim() || !managerEmail.trim()}>
              Create cycle + send links
            </button>
            {status ? <p className="meta" style={{ marginTop: 8 }}>{status}</p> : null}
          </div>
        </section>
      ) : (
        <section className="card" style={{ marginBottom: 14 }}>
          <p className="meta">You are in participant mode. Cycle setup is admin-controlled.</p>
        </section>
      )}

      <section className="card">
        <h2 style={{ marginTop: 0 }}>{isAdmin ? "All cycles" : "My cycles"}</h2>
        {cycles.length === 0 ? (
          <p className="meta">No cycles yet.</p>
        ) : (
          <div className="grid">
            {cycles.map((c) => (
              <button key={c.id} className="button ghost" style={{ textAlign: "left" }} onClick={() => router.push(`/assessment360/${c.id}`)}>
                <strong>{c.title}</strong>
                <div className="meta">{c.participant_name} · {new Date(c.created_at).toLocaleString()} {c.my_role ? `· role: ${c.my_role}` : ""}</div>
                {isAdmin && c.assessment360_cycle_participants ? (
                  <div className="meta" style={{ marginTop: 4 }}>
                    {c.assessment360_cycle_participants.map((p) => `${p.role}:${p.invite_status}`).join(" · ")}
                  </div>
                ) : null}
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
