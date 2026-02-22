"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Message = { id: string; sender: "user" | "assistant"; content: string; created_at: string };
type ScenarioMeta = { id: string; name: string; role: string; context: Record<string, unknown> | null };

function contextLine(label: string, value: unknown) {
  if (!value) return null;
  return <li><strong>{label}:</strong> {String(value)}</li>;
}

export default function SimulationAttemptPage() {
  const params = useParams<{ attemptId: string }>();
  const router = useRouter();
  const attemptId = params?.attemptId;

  const [messages, setMessages] = useState<Message[]>([]);
  const [scenario, setScenario] = useState<ScenarioMeta | null>(null);
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("loading");
  const [busy, setBusy] = useState(false);

  const userTurns = useMemo(() => messages.filter((m) => m.sender === "user").length, [messages]);
  const stage = userTurns <= 1 ? "Discovery" : userTurns <= 3 ? "Value framing" : userTurns <= 5 ? "Objection handling" : "Close / next step";

  const loadMessages = useCallback(async () => {
    if (!attemptId) return;
    const [msgRes, metaRes] = await Promise.all([
      supabase.from("simulation_messages").select("id, sender, content, created_at").eq("attempt_id", attemptId).order("created_at", { ascending: true }),
      fetch(`/api/simulations/${attemptId}`, { cache: "no-store" }),
    ]);
    if (msgRes.error) return setStatus(`error: ${msgRes.error.message}`);
    const metaJson = await metaRes.json();
    if (metaRes.ok) setScenario((metaJson.attempt?.simulation_scenarios as ScenarioMeta) ?? null);
    setMessages((msgRes.data as Message[]) ?? []);
    setStatus("running");
  }, [attemptId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadMessages(); }, [loadMessages]);

  async function sendMessage() {
    if (!attemptId || !content.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/simulations/${attemptId}/message`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) });
    const json = await res.json();
    if (!res.ok) { setStatus(`error: ${json.error ?? "failed to send"}`); setBusy(false); return; }
    setContent("");
    await loadMessages();
    setBusy(false);
  }

  async function endSimulation() {
    if (!attemptId) return;
    setBusy(true);
    const res = await fetch(`/api/simulations/${attemptId}/end`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) { setStatus(`error: ${json.error ?? "failed to end"}`); setBusy(false); return; }
    router.push(`/simulation/${attemptId}/results?jobId=${json.jobId}`);
  }

  return (
    <main className="page grid">
      <div>
        <h1 className="title">Simulation</h1>
        <p className="subtitle">Attempt: {attemptId}</p>
        <span className="badge">Status: {status}</span>
      </div>

      <div className="progress">
        <span className={`step ${stage === "Discovery" ? "active" : ""}`}>Discovery</span>
        <span className={`step ${stage === "Value framing" ? "active" : ""}`}>Value</span>
        <span className={`step ${stage === "Objection handling" ? "active" : ""}`}>Objection</span>
        <span className={`step ${stage === "Close / next step" ? "active" : ""}`}>Close</span>
      </div>

      <section className="two-col">
        <aside className="card">
          <strong>Scenario brief</strong>
          {scenario ? (
            <>
              <p className="meta" style={{ marginTop: 8 }}><strong>{scenario.name}</strong> · Buyer: {scenario.role}</p>
              {scenario.context ? (
                <ul style={{ paddingLeft: 18 }}>
                  {contextLine("Company", scenario.context.company)}
                  {contextLine("Industry", scenario.context.industry)}
                  {contextLine("Current challenge", scenario.context.challenge)}
                  {contextLine("Desired outcome", scenario.context.goal)}
                  {contextLine("Stake/pressure", scenario.context.stakes)}
                  {contextLine("Deal stage", scenario.context.deal_stage)}
                  {contextLine("Buyer profile", scenario.context.buyer_profile)}
                  {contextLine("Your seller role", scenario.context.seller_role)}
                  {contextLine("Seller mandate", scenario.context.seller_mandate)}
                </ul>
              ) : null}
            </>
          ) : <p className="meta">Loading scenario...</p>}
        </aside>

        <section className="card grid">
          <div className="chatWrap">
            {messages.length === 0 ? <p className="meta">No messages yet.</p> : messages.map((m) => (
              <div key={m.id} className={`bubble ${m.sender === "user" ? "user" : "assistant"}`}>
                <div className="meta" style={{ marginBottom: 4 }}>{m.sender === "user" ? "You" : "Buyer"}</div>
                {m.content}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <input className="input" value={content} onChange={(e) => setContent(e.target.value)} placeholder="Type your response..." disabled={busy} />
            <button className="button" onClick={sendMessage} disabled={busy || !content.trim()}>Send</button>
          </div>

          <button className="button ghost" onClick={endSimulation} disabled={busy}>End simulation and score</button>
        </section>
      </section>
    </main>
  );
}
