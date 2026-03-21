"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import { useEffect, useMemo, useState } from "react";
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
  const [createdLinks, setCreatedLinks] = useState<{ login: string; self: string; manager: string } | null>(null);
  const [inviteResults, setInviteResults] = useState<Array<{ role: "self" | "manager"; email: string; status: "sent" | "failed"; error: string | null }>>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const selfEmailValid = emailRegex.test(selfEmail.trim());
  const managerEmailValid = emailRegex.test(managerEmail.trim());
  const sameEmail = selfEmail.trim().toLowerCase() === managerEmail.trim().toLowerCase() && selfEmail.trim() !== "";

  const createDisabled = useMemo(
    () => busy || !title.trim() || !selfName.trim() || !selfEmail.trim() || !managerName.trim() || !managerEmail.trim() || !selfEmailValid || !managerEmailValid || sameEmail,
    [busy, title, selfName, selfEmail, managerName, managerEmail, selfEmailValid, managerEmailValid, sameEmail],
  );

  async function authHeaders(): Promise<Record<string, string>> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
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

  function inviteTone(statusValue: "pending" | "sent" | "failed") {
    if (statusValue === "sent") return "#166534";
    if (statusValue === "failed") return "#b91c1c";
    return "#475569";
  }

  async function createCycleAsAdmin() {
    if (createDisabled) {
      setStatus("Please complete all fields with valid emails before creating a cycle.");
      return;
    }
    setBusy(true);
    setCreatedLinks(null);
    setInviteResults([]);
    setStatus("creating cycle...");

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

    setStatus(json.message ?? "Cycle created.");
    if (json.links) setCreatedLinks(json.links);
    setInviteResults(json.inviteResults ?? []);
    setBusy(false);
    await loadCycles();
    router.push(`/assessment360/${json.cycleId}`);
  }

  return (
    <main className="page">
      <h1 className="title">Future SE 180° Assessment</h1>
      <p className="subtitle">Admin-managed self + manager assignments (manual link sharing mode).</p>
      <p className="meta" style={{ marginTop: -4 }}>Tip: open cycles from this list to avoid invalid route IDs.</p>

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
            {selfEmail.trim() && !selfEmailValid ? <div className="meta" style={{ color: "#b91c1c" }}>Enter a valid email address.</div> : null}
          </label>
          <label>
            Manager name
            <input className="input" value={managerName} onChange={(e) => setManagerName(e.target.value)} placeholder="e.g. Priya Manager" disabled={busy} />
          </label>
          <label>
            Manager email
            <input className="input" value={managerEmail} onChange={(e) => setManagerEmail(e.target.value)} placeholder="manager@company.com" disabled={busy} />
            {managerEmail.trim() && !managerEmailValid ? <div className="meta" style={{ color: "#b91c1c" }}>Enter a valid email address.</div> : null}
            {sameEmail ? <div className="meta" style={{ color: "#b91c1c" }}>Self and manager emails must be different.</div> : null}
          </label>
          <div>
            <button className="button" onClick={createCycleAsAdmin} disabled={createDisabled}>
              Create cycle
            </button>
            {status ? <p className="meta" style={{ marginTop: 8 }}>{status}</p> : null}
            {createdLinks ? (
              <div className="meta" style={{ marginTop: 8 }}>
                <div>Login URL: {createdLinks.login}</div>
                <div>Cycle URL (self): {createdLinks.self}</div>
                <div>Cycle URL (manager): {createdLinks.manager}</div>
              </div>
            ) : null}
            {inviteResults.length ? (
              <div className="meta" style={{ marginTop: 8 }}>
                {inviteResults.map((r) => (
                  <div key={`${r.role}-${r.email}`}>
                    {r.role}: {r.email} → {r.status}{r.error ? ` (${r.error})` : ""}
                  </div>
                ))}
              </div>
            ) : null}
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
                  <div className="meta" style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {c.assessment360_cycle_participants.map((p) => (
                      <span
                        key={`${c.id}-${p.role}`}
                        style={{
                          padding: "2px 8px",
                          borderRadius: 999,
                          border: "1px solid #cbd5e1",
                          color: inviteTone(p.invite_status),
                          background: "#f8fafc",
                          textTransform: "capitalize",
                        }}
                      >
                        {p.role}: {p.invite_status}
                      </span>
                    ))}
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
