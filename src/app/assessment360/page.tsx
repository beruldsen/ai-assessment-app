"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type SubmissionState = {
  rater_type: "self" | "manager";
  status: "draft" | "final_submitted";
  submitted_at: string | null;
  version: number;
};

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
    invite_error?: string | null;
  }>;
  submissions?: SubmissionState[];
};

export default function Assessment360HomePage() {
  const router = useRouter();
  const [title, setTitle] = useState("Future-Ready SE 180");
  const [selfName, setSelfName] = useState("");
  const [selfEmail, setSelfEmail] = useState("");
  const [managerName, setManagerName] = useState("");
  const [managerEmail, setManagerEmail] = useState("");
  const [sendCompletionEmail, setSendCompletionEmail] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [createdLinks, setCreatedLinks] = useState<{ login: string; self: string; manager: string } | null>(null);
  const [inviteResults, setInviteResults] = useState<Array<{ role: "self" | "manager"; email: string; status: "sent" | "failed"; error: string | null }>>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "sent" | "failed" | "draft" | "submitted">("all");

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

  function inviteBadgeStyle(statusValue: "pending" | "sent" | "failed") {
    if (statusValue === "sent") return { background: "#ecfdf5", color: "#166534", border: "1px solid #a7f3d0" };
    if (statusValue === "failed") return { background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" };
    return { background: "#f8fafc", color: "#475569", border: "1px solid #cbd5e1" };
  }

  function submissionBadgeStyle(statusValue: "draft" | "final_submitted" | "not_started") {
    if (statusValue === "final_submitted") return { background: "#ecfdf5", color: "#166534", border: "1px solid #a7f3d0" };
    if (statusValue === "draft") return { background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" };
    return { background: "#f8fafc", color: "#475569", border: "1px solid #cbd5e1" };
  }

  function findParticipant(cycle: Cycle, role: "self" | "manager") {
    return cycle.assessment360_cycle_participants?.find((p) => p.role === role);
  }

  function findSubmission(cycle: Cycle, role: "self" | "manager") {
    return cycle.submissions?.find((s) => s.rater_type === role);
  }

  function overallStatus(cycle: Cycle) {
    const selfSubmission = findSubmission(cycle, "self")?.status;
    const managerSubmission = findSubmission(cycle, "manager")?.status;
    const selfInvite = findParticipant(cycle, "self")?.invite_status;
    const managerInvite = findParticipant(cycle, "manager")?.invite_status;

    if (selfSubmission === "final_submitted" && managerSubmission === "final_submitted") return "Submitted";
    if (selfSubmission === "draft" || managerSubmission === "draft") return "In progress";
    if (selfInvite === "failed" || managerInvite === "failed") return "Invite failed";
    if (selfInvite === "sent" || managerInvite === "sent") return "Invited";
    return "Pending";
  }

  const visibleCycles = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return cycles.filter((cycle) => {
      const selfParticipant = findParticipant(cycle, "self");
      const managerParticipant = findParticipant(cycle, "manager");
      const selfSubmission = findSubmission(cycle, "self")?.status ?? "not_started";
      const managerSubmission = findSubmission(cycle, "manager")?.status ?? "not_started";
      const statusHaystack = [
        selfParticipant?.invite_status,
        managerParticipant?.invite_status,
        selfSubmission,
        managerSubmission,
        overallStatus(cycle).toLowerCase(),
      ].filter(Boolean).join(" ");

      const matchesSearch = !needle || [
        cycle.title,
        cycle.participant_name,
        selfParticipant?.email,
        managerParticipant?.name,
        managerParticipant?.email,
      ].filter(Boolean).some((value) => String(value).toLowerCase().includes(needle));

      const matchesFilter = statusFilter === "all" || statusHaystack.includes(statusFilter);
      return matchesSearch && matchesFilter;
    });
  }, [cycles, search, statusFilter]);

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setStatus("Copied link to clipboard.");
    } catch {
      setStatus("Could not copy automatically. Please copy manually.");
    }
  }

  async function resendInvite(cycleId: string, role: "self" | "manager") {
    setBusy(true);
    setStatus(`Resending ${role} invite...`);
    const res = await fetch("/api/assessment360/cycles", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ cycleId, role }),
    });
    const json = await res.json();
    setBusy(false);
    setStatus(json.message ?? (res.ok ? `${role} invite resent.` : `Failed to resend ${role} invite.`));
    await loadCycles();
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
      body: JSON.stringify({ title: title.trim(), selfName: selfName.trim(), selfEmail: selfEmail.trim(), managerName: managerName.trim(), managerEmail: managerEmail.trim(), sendCompletionEmail }),
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
    router.push(`/assessment360/${json.cycleId}?as=admin`);
  }

  return (
    <main className="page">
      <h1 className="title">Future SE 180° Assessment</h1>
      <p className="subtitle">Admin workspace for creating, tracking, and reviewing self + manager assessments.</p>
      <p className="meta" style={{ marginTop: -4 }}>Use the admin table below to track invite status, progress, and report readiness.</p>

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
          <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input type="checkbox" checked={sendCompletionEmail} onChange={(e) => setSendCompletionEmail(e.target.checked)} disabled={busy} />
            <span>Send report-ready email to self + manager when both assessments are completed</span>
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
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>{isAdmin ? "Assessment operations" : "My cycles"}</h2>
          {isAdmin ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                className="input"
                style={{ minWidth: 260 }}
                placeholder="Search by title, participant, or email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} style={{ minWidth: 180 }}>
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="sent">Invited</option>
                <option value="failed">Invite failed</option>
                <option value="draft">Draft in progress</option>
                <option value="submitted">Submitted</option>
              </select>
            </div>
          ) : null}
        </div>

        {visibleCycles.length === 0 ? (
          <p className="meta">No cycles found.</p>
        ) : isAdmin ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid var(--border)" }}>Assessment</th>
                  <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid var(--border)" }}>Participant</th>
                  <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid var(--border)" }}>Manager</th>
                  <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid var(--border)" }}>Self</th>
                  <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid var(--border)" }}>Manager</th>
                  <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid var(--border)" }}>Overall</th>
                  <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid var(--border)" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleCycles.map((c) => {
                  const selfParticipant = findParticipant(c, "self");
                  const managerParticipant = findParticipant(c, "manager");
                  const selfSubmission = findSubmission(c, "self")?.status ?? "not_started";
                  const managerSubmission = findSubmission(c, "manager")?.status ?? "not_started";
                  const cycleLink = `/assessment360/${c.id}?as=admin`;
                  const publicCycleLink = `${window.location.origin}/assessment360/${c.id}`;
                  return (
                    <tr key={c.id}>
                      <td style={{ padding: "12px 8px", borderBottom: "1px solid var(--border)", verticalAlign: "top" }}>
                        <div style={{ fontWeight: 700 }}>{c.title}</div>
                        <div className="meta">Created {new Date(c.created_at).toLocaleString()}</div>
                      </td>
                      <td style={{ padding: "12px 8px", borderBottom: "1px solid var(--border)", verticalAlign: "top" }}>
                        <div style={{ fontWeight: 600 }}>{selfParticipant?.name ?? c.participant_name}</div>
                        <div className="meta">{selfParticipant?.email ?? "-"}</div>
                      </td>
                      <td style={{ padding: "12px 8px", borderBottom: "1px solid var(--border)", verticalAlign: "top" }}>
                        <div style={{ fontWeight: 600 }}>{managerParticipant?.name ?? "-"}</div>
                        <div className="meta">{managerParticipant?.email ?? "-"}</div>
                      </td>
                      <td style={{ padding: "12px 8px", borderBottom: "1px solid var(--border)", verticalAlign: "top" }}>
                        <div style={{ display: "inline-flex", padding: "2px 8px", borderRadius: 999, ...inviteBadgeStyle(selfParticipant?.invite_status ?? "pending") }}>
                          invite: {selfParticipant?.invite_status ?? "pending"}
                        </div>
                        {selfParticipant?.invite_error ? <div className="meta" style={{ color: "#b91c1c", marginTop: 6, maxWidth: 240 }}>Error: {selfParticipant.invite_error}</div> : null}
                        {selfParticipant?.invite_sent_at ? <div className="meta" style={{ marginTop: 4 }}>Last sent: {new Date(selfParticipant.invite_sent_at).toLocaleString()}</div> : null}
                        <div style={{ height: 6 }} />
                        <div style={{ display: "inline-flex", padding: "2px 8px", borderRadius: 999, ...submissionBadgeStyle(selfSubmission) }}>
                          {selfSubmission === "not_started" ? "not started" : selfSubmission === "final_submitted" ? "submitted" : "draft"}
                        </div>
                      </td>
                      <td style={{ padding: "12px 8px", borderBottom: "1px solid var(--border)", verticalAlign: "top" }}>
                        <div style={{ display: "inline-flex", padding: "2px 8px", borderRadius: 999, ...inviteBadgeStyle(managerParticipant?.invite_status ?? "pending") }}>
                          invite: {managerParticipant?.invite_status ?? "pending"}
                        </div>
                        {managerParticipant?.invite_error ? <div className="meta" style={{ color: "#b91c1c", marginTop: 6, maxWidth: 240 }}>Error: {managerParticipant.invite_error}</div> : null}
                        {managerParticipant?.invite_sent_at ? <div className="meta" style={{ marginTop: 4 }}>Last sent: {new Date(managerParticipant.invite_sent_at).toLocaleString()}</div> : null}
                        <div style={{ height: 6 }} />
                        <div style={{ display: "inline-flex", padding: "2px 8px", borderRadius: 999, ...submissionBadgeStyle(managerSubmission) }}>
                          {managerSubmission === "not_started" ? "not started" : managerSubmission === "final_submitted" ? "submitted" : "draft"}
                        </div>
                      </td>
                      <td style={{ padding: "12px 8px", borderBottom: "1px solid var(--border)", verticalAlign: "top" }}>
                        <span className="badge" style={overallStatus(c) === "Submitted" ? { background: "#ecfdf5", color: "#166534" } : overallStatus(c) === "Invite failed" ? { background: "#fef2f2", color: "#b91c1c" } : overallStatus(c) === "In progress" ? { background: "#eff6ff", color: "#1d4ed8" } : {}}>
                          {overallStatus(c)}
                        </span>
                      </td>
                      <td style={{ padding: "12px 8px", borderBottom: "1px solid var(--border)", verticalAlign: "top" }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button className="button ghost" onClick={() => router.push(cycleLink)}>Open</button>
                          <button className="button ghost" onClick={() => router.push(`/assessment360/${c.id}/report`)}>Report</button>
                          <button className="button ghost" onClick={() => copyText(publicCycleLink)}>Copy self link</button>
                          <button className="button ghost" onClick={() => copyText(publicCycleLink)}>Copy manager link</button>
                          <button className="button ghost" disabled={busy} onClick={() => resendInvite(c.id, "self")}>Resend self</button>
                          <button className="button ghost" disabled={busy} onClick={() => resendInvite(c.id, "manager")}>Resend manager</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid">
            {visibleCycles.map((c) => (
              <button
                key={c.id}
                className="button ghost"
                style={{ textAlign: "left" }}
                onClick={() => router.push(`/assessment360/${c.id}`)}
              >
                <strong>{c.title}</strong>
                <div className="meta">{c.participant_name} · {new Date(c.created_at).toLocaleString()} {c.my_role ? `· role: ${c.my_role}` : ""}</div>
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
