"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Msg = { id: string; sender: "user" | "assistant"; content: string; created_at: string };

export default function SimulationPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("ready");
  const [busy, setBusy] = useState(false);

  async function loadMessages() {
    if (!attemptId) return;

    const res = await fetch(`/api/simulations/${attemptId}/messages`, {
      method: "GET",
      cache: "no-store",
    });

    const json = await res.json();
    if (!res.ok) {
      setStatus(`error: ${json.error ?? "failed to load messages"}`);
      return;
    }

    setMessages((json.messages as Msg[]) ?? []);
  }

  useEffect(() => {
    loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  async function send() {
    if (!attemptId || !input.trim()) return;
    setBusy(true);

    const content = input.trim();
    setInput("");

    const res = await fetch(`/api/simulations/${attemptId}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });

    const json = await res.json();
    if (!res.ok) {
      setStatus(`error: ${json.error ?? "failed"}`);
      setBusy(false);
      return;
    }

    await loadMessages();
    setBusy(false);
  }

  async function end() {
    if (!attemptId) return;
    setBusy(true);

    const res = await fetch(`/api/simulations/${attemptId}/end`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) {
      setStatus(`error: ${json.error ?? "failed"}`);
      setBusy(false);
      return;
    }

    setStatus("completed");
    setBusy(false);
  }

  return (
    <main style={{ padding: 24, maxWidth: 840, margin: "0 auto" }}>
      <h1>Simulation Attempt</h1>
      <p>Attempt: {attemptId}</p>
      <p>Status: {status}</p>

      <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, minHeight: 260 }}>
        {messages.map((m) => (
          <div key={m.id} style={{ marginBottom: 8 }}>
            <strong>{m.sender === "user" ? "You" : "CFO"}:</strong> {m.content}
          </div>
        ))}
        {messages.length === 0 && <p style={{ opacity: 0.7 }}>No messages yet.</p>}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your response..."
          style={{ flex: 1, padding: 10 }}
          disabled={busy || status === "completed"}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button onClick={send} disabled={busy || status === "completed" || !input.trim()}>
          Send
        </button>
        <button onClick={end} disabled={busy || status === "completed"}>
          End
        </button>
      </div>
    </main>
  );
}
