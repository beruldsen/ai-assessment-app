"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Message = {
  id: string;
  sender: "user" | "assistant";
  content: string;
  created_at: string;
};

export default function SimulationAttemptPage() {
  const params = useParams<{ attemptId: string }>();
  const attemptId = params?.attemptId;

  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("loading");
  const [busy, setBusy] = useState(false);

  async function loadMessages() {
    if (!attemptId) return;

    const { data, error } = await supabase
      .from("simulation_messages")
      .select("id, sender, content, created_at")
      .eq("attempt_id", attemptId)
      .order("created_at", { ascending: true });

    if (error) {
      setStatus(`error: ${error.message}`);
      return;
    }

    setMessages((data as Message[]) ?? []);
    setStatus("ready");
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
    setBusy(false);
  }

  return (
    <main style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      <h1>Simulation</h1>
      <p>Attempt: {attemptId}</p>
      <p>Status: {status}</p>

      <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, minHeight: 220 }}>
        {messages.length === 0 ? (
          <p style={{ opacity: 0.7 }}>No messages yet.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} style={{ marginBottom: 10 }}>
              <strong>{m.sender === "user" ? "You" : "Assistant"}:</strong> {m.content}
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
        End simulation
      </button>
    </main>
  );
}
