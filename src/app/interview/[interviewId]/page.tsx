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
  const [recordingState, setRecordingState] = useState<"idle" | "recording" | "processing">("idle");
  const [inputMode, setInputMode] = useState<"voice" | "text">("voice");
  const [content, setContent] = useState("");
  const [supportsRecording, setSupportsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

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

  useEffect(() => {
    setSupportsRecording(typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined");
  }, []);

  useEffect(() => {
    void loadInterview();
  }, [loadInterview]);

  const lastAssistant = useMemo(() => [...messages].reverse().find((m) => m.role === "assistant"), [messages]);

  async function playAssistantAudio(text: string) {
    if (!interviewId || !text.trim()) return;
    try {
      const res = await fetch(`/api/interviews/${interviewId}/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: text }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play().catch(() => undefined);
      audio.onended = () => URL.revokeObjectURL(url);
    } catch {
      // ignore and fall back silently
    }
  }

  useEffect(() => {
    if (lastAssistant?.transcript_text) {
      void playAssistantAudio(lastAssistant.transcript_text);
    }
  }, [lastAssistant?.id]);

  async function sendTextMessage(value: string, mode: "voice" | "text") {
    if (!interviewId || !value.trim()) return;
    const res = await fetch(`/api/interviews/${interviewId}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: value.trim(), inputMode: mode, outputMode: "tts" }),
    });
    const json = await res.json();
    if (!res.ok) {
      setStatus(`error: ${json.error ?? "failed to send"}`);
      return;
    }
    setContent("");
    await loadInterview();
  }

  async function transcribeAudio(blob: Blob) {
    if (!interviewId) return "";
    const formData = new FormData();
    formData.append("file", new File([blob], "answer.webm", { type: blob.type || "audio/webm" }));

    const res = await fetch(`/api/interviews/${interviewId}/audio`, {
      method: "POST",
      body: formData,
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error ?? "failed to transcribe audio");
    }
    return String(json.text ?? "").trim();
  }

  async function startRecording() {
    if (!supportsRecording) {
      setInputMode("text");
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    const recorder = new MediaRecorder(stream);
    mediaRecorderRef.current = recorder;
    audioChunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) audioChunksRef.current.push(event.data);
    };

    recorder.onstart = () => setRecordingState("recording");
    recorder.onstop = async () => {
      setRecordingState("processing");
      try {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const transcript = await transcribeAudio(blob);
        if (transcript) {
          await sendTextMessage(transcript, "voice");
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "voice processing failed";
        setStatus(`error: ${message}`);
      } finally {
        setRecordingState("idle");
        streamRef.current?.getTracks().forEach((track) => track.stop());
      }
    };

    recorder.start();
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
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
    if (lastAssistant?.transcript_text) {
      void playAssistantAudio(lastAssistant.transcript_text);
    }
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
        <div className="meta">Mode: Push-to-talk voice with text fallback</div>
        <div className="meta">Recording state: {recordingState}</div>
      </section>

      <section className="card grid">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="button" onClick={() => void startRecording()} disabled={recordingState === "recording"}>Start recording</button>
          <button className="button ghost" onClick={stopRecording} disabled={recordingState !== "recording"}>Stop and submit</button>
          <button className="button ghost" onClick={replayLastQuestion}>Replay question</button>
          <button className="button ghost" onClick={() => setInputMode((m) => (m === "voice" ? "text" : "voice"))}>Use {inputMode === "voice" ? "text fallback" : "voice mode"}</button>
          <button className="button ghost" onClick={() => void completeInterview()}>Complete interview</button>
        </div>
        {!supportsRecording ? <div className="meta">Browser recording is unavailable here, so text fallback is enabled.</div> : null}
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
            <button className="button" onClick={() => void sendTextMessage(content, "text")} disabled={!content.trim()}>Send</button>
          </div>
        ) : null}
      </section>
    </main>
  );
}
