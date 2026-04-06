"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";

type Message = {
  id: string;
  capability: string | null;
  role: "assistant" | "user" | "system";
  transcript_text: string;
  audio_url?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
};

type InterviewState = {
  id: string;
  status: "running" | "completed" | "failed";
  selected_capabilities: string[];
  current_capability: string | null;
};

export default function InterviewPage() {
  const params = useParams<{ interviewId: string }>();
  const interviewId = params?.interviewId;

  const [interview, setInterview] = useState<InterviewState | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState("loading");
  const [inputMode, setInputMode] = useState<"voice" | "text">("voice");
  const [recordingState, setRecordingState] = useState<"idle" | "recording" | "processing">("idle");
  const [content, setContent] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const SpeechRecognitionCtor = useMemo(() => {
    if (typeof window === "undefined") return null;
    return (window as typeof window & { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition
      ?? (window as typeof window & { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition
      ?? null;
  }, []);

  const loadInterview = useCallback(async () => {
    if (!interviewId) return;
    const res = await fetch(`/api/interviews/${interviewId}`, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) {
      setStatus(`error: ${json.error ?? "failed to load"}`);
      return;
    }
    setInterview(json.interview ?? null);
    setMessages(json.messages ?? []);
    setStatus(json.interview?.status ?? "running");
  }, [interviewId]);

  useMemo(() => {
    void loadInterview();
  }, [loadInterview]);

  useEffect(() => {
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    if (!lastAssistant?.transcript_text) return;
    if (!("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(lastAssistant.transcript_text);
    utterance.rate = 1;
    utterance.pitch = 1;
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  }, [messages]);

  function startVoiceInput() {
    if (!SpeechRecognitionCtor) {
      setInputMode("text");
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setRecordingState("recording");
    recognition.onend = () => setRecordingState("idle");
    recognition.onerror = () => {
      setRecordingState("idle");
      setInputMode("text");
    };
    recognition.onresult = async (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim() ?? "";
      if (!transcript) return;
      setRecordingState("processing");
      await sendMessage(transcript, "voice");
      setRecordingState("idle");
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  function stopVoiceInput() {
    recognitionRef.current?.stop();
    setRecordingState("idle");
  }

  async function sendMessage(value: string, mode: "voice" | "text") {
    if (!interviewId || !value.trim()) return;
    const res = await fetch(`/api/interviews/${interviewId}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: value.trim(), inputMode: mode, outputMode: "voice" }),
    });
    const json = await res.json();
    if (!res.ok) {
      setStatus(`error: ${json.error ?? "failed to send"}`);
      return;
    }
    setContent("");
    await loadInterview();
  }

  async function completeInterview() {
    if (!interviewId) return;
    const res = await fetch(`/api/interviews/${interviewId}/complete`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) {
      setStatus(`error: ${json.error ?? "failed to complete"}`);
      return;
    }
    setStatus("completed");
    await loadInterview();
  }

  function replayLastQuestion() {
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    if (!lastAssistant?.transcript_text || !("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(lastAssistant.transcript_text);
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  }

  return (
    <main className="page grid">
      <div>
        <h1 className="title">Voice Behavioural Interview</h1>
        <p className="subtitle">Interview ID: {interviewId}</p>
        <span className="badge">Status: {status}</span>
      </div>

      <section className="card grid">
        <strong>Current capability</strong>
        <p className="meta">{interview?.current_capability ?? "Loading..."}</p>
        <div className="meta">Interaction mode: {inputMode === "voice" ? "Voice-first" : "Text fallback"}</div>
        <div className="meta">Recording state: {recordingState}</div>
      </section>

      <section className="card grid">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="button" onClick={startVoiceInput} disabled={recordingState === "recording"}>Start speaking</button>
          <button className="button ghost" onClick={stopVoiceInput} disabled={recordingState !== "recording"}>Stop</button>
          <button className="button ghost" onClick={replayLastQuestion}>Replay question</button>
          <button className="button ghost" onClick={() => setInputMode((m) => (m === "voice" ? "text" : "voice"))}>Use {inputMode === "voice" ? "text fallback" : "voice"}</button>
          <button className="button ghost" onClick={completeInterview}>Complete interview</button>
        </div>
      </section>

      <section className="card grid">
        <div className="chatWrap">
          {messages.map((message) => (
            <div key={message.id} className={`bubble ${message.role === "user" ? "user" : "assistant"}`}>
              <div className="meta" style={{ marginBottom: 4 }}>
                {message.role === "user" ? "Candidate" : message.role === "assistant" ? "Interviewer" : "System"}
                {message.capability ? ` · ${message.capability}` : ""}
              </div>
              {message.transcript_text}
            </div>
          ))}
        </div>

        {inputMode === "text" ? (
          <div style={{ display: "flex", gap: 8 }}>
            <input className="input" value={content} onChange={(e) => setContent(e.target.value)} placeholder="Type only if voice is unavailable..." />
            <button className="button" onClick={() => void sendMessage(content, "text")} disabled={!content.trim()}>Send</button>
          </div>
        ) : null}
      </section>
    </main>
  );
}
