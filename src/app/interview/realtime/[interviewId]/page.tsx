"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";

type Message = {
  id: string;
  capability: string | null;
  role: "assistant" | "user" | "system";
  transcript_text: string;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
};

type InterviewState = {
  id: string;
  status: "running" | "completed" | "failed";
  selected_capabilities: string[];
  current_capability: string | null;
};

type ConversationItem = {
  id?: string;
  role?: string;
  type?: string;
  status?: string;
  content?: Array<Record<string, unknown>>;
};

export default function RealtimeInterviewSessionPage() {
  const params = useParams<{ interviewId: string }>();
  const interviewId = params?.interviewId;

  const [interview, setInterview] = useState<InterviewState | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState("loading");
  const [connectionState, setConnectionState] = useState("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessionLog, setSessionLog] = useState<string[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [completionBusy, setCompletionBusy] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  const peerRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const chatWrapRef = useRef<HTMLDivElement | null>(null);
  const lastProcessedAssistantIdRef = useRef<string | null>(null);
  const startedRef = useRef(false);

  const lastAssistant = useMemo(() => [...messages].reverse().find((m) => m.role === "assistant"), [messages]);
  const assistantMessages = useMemo(() => messages.filter((m) => m.role === "assistant"), [messages]);
  const currentCapability = interview?.current_capability ?? lastAssistant?.capability ?? null;
  const capabilitySequence = useMemo(() => Array.from(new Set(assistantMessages.map((m) => m.capability).filter(Boolean))), [assistantMessages]);
  const currentCapabilityIndex = currentCapability ? capabilitySequence.indexOf(currentCapability) : -1;

  const appendLog = useCallback((entry: string) => {
    setSessionLog((current) => [entry, ...current].slice(0, 8));
  }, []);

  const loadInterview = useCallback(async () => {
    if (!interviewId) return;
    try {
      const res = await fetch(`/api/interviews/${interviewId}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        setStatus(`error: ${json.error ?? "failed to load"}`);
        setErrorMessage(json.error ?? "Failed to load interview state.");
        return;
      }
      setInterview(json.interview ?? null);
      setMessages(json.messages ?? []);
      setStatus(json.interview?.status ?? "running");
      setErrorMessage(null);
    } catch {
      setStatus("error: failed to load");
      setErrorMessage("We could not load the latest interview state. Please refresh and try again.");
    }
  }, [interviewId]);

  const disconnectRealtime = useCallback(() => {
    dataChannelRef.current?.close();
    dataChannelRef.current = null;

    peerRef.current?.getSenders().forEach((sender) => sender.track?.stop());
    peerRef.current?.close();
    peerRef.current = null;

    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;

    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
    }

    setConnectionState("disconnected");
  }, []);

  const syncLatestUserTurn = useCallback(async (transcript: string) => {
    if (!interviewId || !transcript.trim()) return;

    const res = await fetch(`/api/interviews/${interviewId}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: transcript.trim(), inputMode: "voice", outputMode: "realtime" }),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error ?? "Failed to sync realtime turn");
    }
    await loadInterview();
    return json;
  }, [interviewId, loadInterview]);

  const sendEvent = useCallback((event: Record<string, unknown>) => {
    if (dataChannelRef.current?.readyState === "open") {
      dataChannelRef.current.send(JSON.stringify(event));
    }
  }, []);

  const pushAssistantPrompt = useCallback((text: string) => {
    if (!text.trim()) return;
    sendEvent({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "assistant",
        content: [{ type: "input_text", text }],
      },
    });
    sendEvent({ type: "response.create" });
  }, [sendEvent]);

  const connectRealtime = useCallback(async () => {
    if (!interviewId || isConnecting || connectionState === "connected") return;

    setIsConnecting(true);
    setErrorMessage(null);
    setConnectionState("connecting");

    try {
      const tokenRes = await fetch("/api/interviews/realtime/session", { method: "POST" });
      const tokenJson = await tokenRes.json();
      if (!tokenRes.ok || !tokenJson?.client_secret?.value) {
        throw new Error(tokenJson.error ?? "Failed to create realtime session");
      }

      const pc = new RTCPeerConnection();
      peerRef.current = pc;

      const remoteAudio = new Audio();
      remoteAudio.autoplay = true;
      remoteAudioRef.current = remoteAudio;

      pc.ontrack = (event) => {
        remoteAudio.srcObject = event.streams[0] ?? null;
      };

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const dc = pc.createDataChannel("oai-events");
      dataChannelRef.current = dc;

      dc.onopen = () => {
        setConnectionState("connected");
        appendLog("Realtime voice connected.");
        sendEvent({
          type: "session.update",
          session: {
            instructions: "You are the live voice surface for a structured behavioural interview. Do not invent your own interview flow. Wait for explicit assistant prompt messages and speak them naturally. Keep acknowledgement brief when needed.",
            input_audio_format: "pcm16",
            output_audio_format: "pcm16",
            turn_detection: { type: "server_vad" },
          },
        });
      };

      dc.onmessage = async (event) => {
        try {
          const payload = JSON.parse(event.data) as Record<string, unknown>;
          const type = String(payload.type ?? "");

          if (type === "response.audio_transcript.done") {
            const transcript = String(payload.transcript ?? "").trim();
            if (!transcript) return;
            appendLog(`Candidate: ${transcript}`);
            const result = await syncLatestUserTurn(transcript);
            const assistant = String(result?.assistant ?? "").trim();
            if (assistant) {
              appendLog(`Interviewer: ${assistant}`);
              pushAssistantPrompt(assistant);
            }
          }

          if (type === "error") {
            const err = payload.error as { message?: string } | undefined;
            throw new Error(err?.message ?? "Realtime voice error");
          }
        } catch (e) {
          const message = e instanceof Error ? e.message : "Realtime voice event failed";
          setErrorMessage(message);
          appendLog(`Error: ${message}`);
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpResponse = await fetch("https://api.openai.com/v1/realtime", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenJson.client_secret.value}`,
          "Content-Type": "application/sdp",
          "OpenAI-Beta": "realtime=v1",
        },
        body: offer.sdp,
      });

      if (!sdpResponse.ok) {
        throw new Error(await sdpResponse.text());
      }

      const answer = {
        type: "answer" as RTCSdpType,
        sdp: await sdpResponse.text(),
      };
      await pc.setRemoteDescription(answer);

      const initialAssistant = [...messages].reverse().find((message) => message.role === "assistant" && message.transcript_text.trim());
      if (initialAssistant) {
        pushAssistantPrompt(initialAssistant.transcript_text);
        lastProcessedAssistantIdRef.current = initialAssistant.id;
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to connect realtime voice";
      setErrorMessage(message);
      setConnectionState("error");
      appendLog(`Error: ${message}`);
      disconnectRealtime();
    } finally {
      setIsConnecting(false);
    }
  }, [appendLog, connectionState, disconnectRealtime, interviewId, isConnecting, messages, pushAssistantPrompt, sendEvent, syncLatestUserTurn]);

  async function completeInterview() {
    if (!interviewId || completionBusy) return;
    setCompletionBusy(true);
    try {
      const res = await fetch(`/api/interviews/${interviewId}/complete`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setStatus(`error: ${json.error ?? "failed to complete"}`);
        setErrorMessage(json.error ?? "We could not complete the interview. Please try again.");
        setCompletionBusy(false);
        return;
      }
      setJobId(json.jobId ?? null);
      setStatus("completed");
      setErrorMessage(null);
      await loadInterview();
      disconnectRealtime();
      setCompletionBusy(false);
    } catch {
      setStatus("error: failed to complete");
      setErrorMessage("We could not complete the interview. Please try again.");
      setCompletionBusy(false);
    }
  }

  useEffect(() => {
    void loadInterview();
  }, [loadInterview]);

  useEffect(() => {
    if (!startedRef.current && messages.length) {
      startedRef.current = true;
      void connectRealtime();
    }
  }, [connectRealtime, messages.length]);

  useEffect(() => {
    const latestAssistant = [...messages].reverse().find((message) => message.role === "assistant" && message.transcript_text.trim());
    if (!latestAssistant || connectionState !== "connected") return;
    if (latestAssistant.id === lastProcessedAssistantIdRef.current) return;
    lastProcessedAssistantIdRef.current = latestAssistant.id;
    pushAssistantPrompt(latestAssistant.transcript_text);
  }, [connectionState, messages, pushAssistantPrompt]);

  useEffect(() => {
    const chatWrap = chatWrapRef.current;
    if (!chatWrap) return;
    chatWrap.scrollTo({ top: chatWrap.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    return () => {
      disconnectRealtime();
    };
  }, [disconnectRealtime]);

  useEffect(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) track.enabled = !isMuted;
  }, [isMuted]);

  return (
    <main className="page grid">
      <div className="card surface-hero interview-hero">
        <div>
          <div className="eyebrow">Prototype live assessment</div>
          <h1 className="title">Realtime Behavioural Interview</h1>
          <p className="subtitle">This is an experimental natural-voice version of the behavioural interview. The structured push-to-talk interview remains the safer production path.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span className="badge">Status: {status}</span>
          <span className="badge">Voice connection: {connectionState}</span>
          {currentCapability ? <span className="badge">Current area: {currentCapability}</span> : null}
          {currentCapabilityIndex >= 0 ? <span className="badge">Progress: {currentCapabilityIndex + 1} / {Math.max(capabilitySequence.length, 1)}</span> : null}
        </div>
      </div>

      <section className="card grid">
        <strong>How this prototype works</strong>
        <div className="meta">You can speak naturally when connected. Each completed spoken answer is synced back into the existing interview engine, which decides the next interviewer turn and stores the transcript.</div>
        <div className="meta">This is intentionally a prototype so you can feel the direction without replacing the current stable voice flow.</div>
      </section>

      <section className="card grid interview-sticky-controls">
        {errorMessage ? <div className="meta" style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", padding: 12, borderRadius: 12, fontSize: 13 }}>Error: {errorMessage}</div> : null}
        {interview?.status === "completed" ? (
          <div className="interview-inline-callout interview-inline-callout-success">
            <strong>Interview completed</strong>
            <p className="meta" style={{ margin: "6px 0 10px 0" }}>Your report is being prepared. Open the report below, or refresh if scoring is still in progress.</p>
            {jobId ? <p className="meta" style={{ margin: "0 0 10px 0" }}>Scoring job: {jobId}</p> : null}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="button" onClick={() => void loadInterview()}>Refresh status</button>
              <Link href={`/interview/${interviewId}/results`} className="button" style={{ textDecoration: "none" }}>View report</Link>
              <Link href={`/interview/${interviewId}/results/print`} className="button ghost" style={{ textDecoration: "none" }}>Open print / PDF view</Link>
            </div>
          </div>
        ) : null}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="button" onClick={() => void connectRealtime()} disabled={isConnecting || connectionState === "connected" || interview?.status === "completed"}>
            {isConnecting ? "Connecting..." : connectionState === "connected" ? "Connected" : "Connect voice"}
          </button>
          <button className="button ghost" onClick={() => setIsMuted((current) => !current)} disabled={connectionState !== "connected"}>
            {isMuted ? "Unmute microphone" : "Mute microphone"}
          </button>
          <button className="button ghost" onClick={disconnectRealtime} disabled={connectionState !== "connected" && connectionState !== "connecting"}>Disconnect voice</button>
          <button className="button ghost" onClick={() => void loadInterview()}>Refresh transcript</button>
          <button className="button ghost" onClick={() => void completeInterview()} disabled={completionBusy || interview?.status === "completed"}>{completionBusy ? "Completing..." : "Complete interview"}</button>
          <Link href="/interview" className="button ghost" style={{ textDecoration: "none" }}>Back to standard interview</Link>
        </div>
        <div className="meta">When the connection is live, speak naturally. The system listens for a completed turn, syncs it to the interview engine, then speaks the next interviewer question.</div>
      </section>

      <section className="card grid">
        <strong>Transcript</strong>
        <div className="chatWrap" ref={chatWrapRef}>
          {messages.map((message) => (
            <div key={message.id} className={`bubble ${message.role === "user" ? "user" : "assistant"}`}>
              <div className="meta" style={{ marginBottom: 4 }}>
                {message.role === "user" ? "Participant" : message.role === "assistant" ? "Interviewer" : "System"}
                {message.capability ? ` · ${message.capability}` : ""}
              </div>
              {message.transcript_text}
            </div>
          ))}
        </div>
      </section>

      <section className="card grid">
        <strong>Session log</strong>
        <div className="meta" style={{ display: "grid", gap: 6 }}>
          {sessionLog.length ? sessionLog.map((entry, index) => <div key={`${entry}-${index}`}>{entry}</div>) : <div>No realtime events yet.</div>}
        </div>
      </section>
    </main>
  );
}
