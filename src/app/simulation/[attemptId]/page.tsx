"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Message = {
  id: string;
  sender: "user" | "assistant";
  content: string;
  created_at: string;
};

type ScenarioMeta = {
  id: string;
  name: string;
  role: string;
  context: Record<string, unknown> | null;
};

function contextLine(label: string, value: unknown) {
  if (!value) return null;
  return (
    <li>
      <strong>{label}:</strong> {String(value)}
    </li>
  );
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

  async function loadMessages() {
    if (!attemptId) return;

    const [msgRes, metaRes] = await Promise.all([
      supabase
        .from("simulation_messages")
        .select("id, sender, content, created_at")
        .eq("attempt_id", attemptId)
        .order("created_at", { ascending: true }),
      fetch(`/api/simulations/${attemptId}`, { cache: "no-store" }),
    ]);

    if (msgRes.error) {
      setStatus(`error: ${msgRes.error.message}`);
      return;
    }

    const metaJson = await metaRes.json();
    if (metaRes.ok) {
      setScenario((metaJson.attempt?.simulation_scenarios as ScenarioMeta) ?? null);
    }

    setMessages((msgRes.data as Message[]) ?? []);
    setStatus("running");
  }

  useEffect(() => {
    loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  async function sendMessage() {
    if (!attemptId || !content.trim()) return;
    setBusy(true);

    const res = await fetch(`/api/simulations/${attemptId}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });

    const json = await res.json();
    if (!res.ok) {
      setStatus(`error: ${json.error ?? "failed to send"}`);
      setBusy(false);
      return;
    }

    setContent("");
    await loadMessages();
    setBusy(false);
  }

  async function endSimulation() {
    if (!attemptId) return;
    setBusy(true);

    const res = await fetch(`/api/simulations/${attemptId}/end`, { method: "POST" });
    const json = await res.json();

    if (!res.ok) {
      setStatus(`error: ${json.error ?? "failed to end"}`);
      setBusy(false);
      return;
    }

    setStatus("completed");
    router.push(`/simulation/${attemptId}/results?jobId=${json.jobId}`);
  }

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1>Simulation</h1>
      <p>Attempt: {attemptId}</p>
      <p>Status: {status}</p>

      {scenario ? (
        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 12, background: "#fafafa" }}>
          <strong>Scenario brief</strong>
          <div style={{ marginTop: 6 }}>
            <div><strong>Scenario:</strong> {scenario.name}</div>
            <div><strong>Who you are speaking to:</strong> {scenario.role}</div>
            {scenario.context ? (
              <ul style={{ marginTop: 8, paddingLeft: 18 }}>
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
            <p style={{ marginTop: 8, opacity: 0.8 }}>
              Goal: lead with discovery, then frame business value clearly.
            </p>
          </div>
        </div>
      ) : null}

      <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, minHeight: 260 }}>
        {messages.length === 0 ? (
          <p style={{ opacity: 0.7 }}>No messages yet.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} style={{ marginBottom: 10 }}>
              <strong>{m.sender === "user" ? "You" : "Buyer"}:</strong> {m.content}
            </div>
          ))
        )}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Type your response..."
          style={{ flex: 1, padding: 10 }}
          disabled={busy || status === "completed"}
        />
        <button onClick={sendMessage} disabled={busy || !content.trim() || status === "completed"}>
          Send
        </button>
      </div>

      <button onClick={endSimulation} disabled={busy || status === "completed"} style={{ marginTop: 12 }}>
        End simulation and score
      </button>
    </main>
  );
}
