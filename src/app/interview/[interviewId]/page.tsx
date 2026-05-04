"use client";

import Link from "next/link";
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

function splitIntoSentences(text: string) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function estimateSentenceDurations(sentences: string[]) {
  const wordsPerMinute = 155;
  const minMs = 1400;
  return sentences.map((sentence) => {
    const wordCount = sentence.split(/\s+/).filter(Boolean).length;
    return Math.max(minMs, Math.round((wordCount / wordsPerMinute) * 60_000));
  });
}

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
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingNotice, setRecordingNotice] = useState("Press Start recording when you're ready to answer.");
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [pausePromptVisible, setPausePromptVisible] = useState(false);
  const [readyToRecord, setReadyToRecord] = useState(false);
  const [completionBusy, setCompletionBusy] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const playedAssistantIdsRef = useRef<Set<string>>(new Set());
  const isPlayingAssistantRef = useRef(false);
  const recordingTimerRef = useRef<number | null>(null);
  const recordingStateRef = useRef(recordingState);
  const chatWrapRef = useRef<HTMLDivElement | null>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeAudioUrlRef = useRef<string | null>(null);
  const highlightTimeoutsRef = useRef<number[]>([]);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [speakingSentenceIndex, setSpeakingSentenceIndex] = useState<number | null>(null);

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

  useEffect(() => {
    setSupportsRecording(typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined");
  }, []);

  useEffect(() => {
    void loadInterview();
  }, [loadInterview]);


  const lastAssistant = useMemo(() => [...messages].reverse().find((m) => m.role === "assistant"), [messages]);
  const assistantMessages = useMemo(() => messages.filter((m) => m.role === "assistant"), [messages]);
  const currentCapability = interview?.current_capability ?? lastAssistant?.capability ?? null;
  const capabilitySequence = useMemo(() => Array.from(new Set(assistantMessages.map((m) => m.capability).filter(Boolean))), [assistantMessages]);
  const currentCapabilityIndex = currentCapability ? capabilitySequence.indexOf(currentCapability) : -1;

  function shouldHighlightRecord(message: Message) {
    const kind = (message.metadata as { kind?: string } | null)?.kind;
    return kind === "question" || (!kind && message.role === "assistant");
  }

  const stopActiveAudio = useCallback(() => {
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current.currentTime = 0;
      activeAudioRef.current.onended = null;
      activeAudioRef.current.onerror = null;
      activeAudioRef.current = null;
    }
    if (activeAudioUrlRef.current) {
      URL.revokeObjectURL(activeAudioUrlRef.current);
      activeAudioUrlRef.current = null;
    }
    highlightTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    highlightTimeoutsRef.current = [];
    setSpeakingMessageId(null);
    setSpeakingSentenceIndex(null);
    isPlayingAssistantRef.current = false;
  }, []);

  const playAssistantAudio = useCallback(async (message: Message) => {
    if (!interviewId || !message.transcript_text.trim()) return;
    stopActiveAudio();
    try {
      const res = await fetch(`/api/interviews/${interviewId}/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: message.transcript_text }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      activeAudioRef.current = audio;
      activeAudioUrlRef.current = url;

      const sentences = splitIntoSentences(message.transcript_text);
      const durations = estimateSentenceDurations(sentences);
      let elapsed = 0;
      setSpeakingMessageId(message.id);
      setSpeakingSentenceIndex(0);
      durations.forEach((duration, index) => {
        const timeoutId = window.setTimeout(() => {
          setSpeakingSentenceIndex(index);
        }, elapsed);
        highlightTimeoutsRef.current.push(timeoutId);
        elapsed += duration;
      });

      await audio.play().catch(() => undefined);
      await new Promise<void>((resolve) => {
        audio.onended = () => {
          stopActiveAudio();
          resolve();
        };
        audio.onerror = () => {
          stopActiveAudio();
          resolve();
        };
      });
    } catch {
      stopActiveAudio();
    }
  }, [interviewId, stopActiveAudio]);

  useEffect(() => {
    const unseenAssistantMessages = messages.filter(
      (m) => m.role === "assistant" && !playedAssistantIdsRef.current.has(m.id)
    );

    if (unseenAssistantMessages.length) setReadyToRecord(false);

    if (!unseenAssistantMessages.length || isPlayingAssistantRef.current) return;

    isPlayingAssistantRef.current = true;

    void (async () => {
      for (const message of unseenAssistantMessages) {
        playedAssistantIdsRef.current.add(message.id);
        if (message.transcript_text) {
          await playAssistantAudio(message);
        }
        if (shouldHighlightRecord(message) && recordingStateRef.current === "idle") {
          setReadyToRecord(true);
        }
      }
      isPlayingAssistantRef.current = false;
    })();
  }, [messages, playAssistantAudio]);

  async function sendTextMessage(value: string, mode: "voice" | "text") {
    if (!interviewId || !value.trim()) return;
    stopActiveAudio();
    try {
      const res = await fetch(`/api/interviews/${interviewId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: value.trim(), inputMode: mode, outputMode: "tts" }),
      });
      const json = await res.json();
      if (!res.ok) {
        setStatus(`error: ${json.error ?? "failed to send"}`);
        setErrorMessage(json.error ?? "We could not save that response. Please try again.");
        return;
      }
      setContent("");
      setErrorMessage(null);
      await loadInterview();
    } catch {
      setStatus("error: failed to send");
      setErrorMessage("We could not save that response. Please check your connection and try again.");
    }
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

  useEffect(() => {
    recordingStateRef.current = recordingState;
  }, [recordingState]);

  useEffect(() => {
    if (recordingState !== "recording") return;

    recordingTimerRef.current = window.setInterval(() => {
      setRecordingSeconds((s) => s + 1);
    }, 1000);

    return () => {
      if (recordingTimerRef.current) {
        window.clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    };
  }, [recordingState]);

  useEffect(() => {
    if (recordingState === "recording") {
      if (recordingSeconds === 0) setRecordingNotice("Recording live. Speak naturally, then press Stop and submit when you’re finished.");
      else if (recordingSeconds >= 45) setRecordingNotice("Still recording. If you’ve finished your answer, press Stop and submit.");
      else if (recordingSeconds >= 20) setRecordingNotice("You’re still being recorded. Take a moment to finish your answer, then press Stop and submit.");
      setPausePromptVisible(recordingSeconds >= 35);
    } else if (recordingState === "processing") {
      setRecordingNotice("Processing your response and preparing the next step...");
      setPausePromptVisible(false);
    } else {
      setRecordingNotice("Press Start recording when you're ready to answer.");
      setPausePromptVisible(false);
    }
  }, [recordingState, recordingSeconds]);

  async function startRecording() {
    if (!supportsRecording) {
      setInputMode("text");
      setErrorMessage("Voice recording is not available in this browser, so text fallback has been enabled.");
      return;
    }

    try {
      stopActiveAudio();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setErrorMessage(null);
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstart = () => {
        setRecordingSeconds(0);
        setReadyToRecord(false);
        setRecordingState("recording");
      };
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
          setErrorMessage(message);
        } finally {
          setRecordingState("idle");
          setRecordingSeconds(0);
          streamRef.current?.getTracks().forEach((track) => track.stop());
        }
      };

      recorder.start();
    } catch {
      setInputMode("text");
      setErrorMessage("Microphone access was blocked or unavailable. You can continue with text input instead.");
    }
  }

  function stopRecording() {
    setRecordingNotice("Finishing your response...");
    mediaRecorderRef.current?.stop();
  }

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
      setCompletionBusy(false);
    } catch {
      setStatus("error: failed to complete");
      setErrorMessage("We could not complete the interview. Please try again.");
      setCompletionBusy(false);
    }
  }

  useEffect(() => {
    const chatWrap = chatWrapRef.current;
    if (!chatWrap) return;
    chatWrap.scrollTo({ top: chatWrap.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    return () => {
      stopActiveAudio();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [stopActiveAudio]);

  useEffect(() => {
    if (showCompleteConfirm || interview?.status === "completed" || recordingState === "processing") {
      stopActiveAudio();
    }
  }, [showCompleteConfirm, interview?.status, recordingState, stopActiveAudio]);

  function replayLastQuestion() {
    if (lastAssistant?.transcript_text) {
      void playAssistantAudio(lastAssistant);
    }
  }

  return (
    <main className="page grid">
      <div className="card surface-hero interview-hero">
        <div>
          <div className="eyebrow">Live assessment</div>
          <h1 className="title">Sales Engineering Capability Assessment - AI Behavioural Based Interview</h1>
          <p className="subtitle">Interview ID: {interviewId}</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span className="badge">Status: {status}</span>
          {currentCapability ? <span className="badge">Current area: {currentCapability}</span> : null}
          {currentCapabilityIndex >= 0 ? <span className="badge">Progress: {currentCapabilityIndex + 1} / {Math.max(capabilitySequence.length, 1)}</span> : null}
        </div>
      </div>

      <section className="card grid">
        <strong>Current capability</strong>
        <p className="meta">{currentCapability ?? "Loading..."}</p>
        <div className="meta">Mode: Guided voice interview with text fallback</div>
        <div className="meta">Recording state: {recordingState}</div>
        {currentCapabilityIndex >= 0 ? (
          <>
            <div style={{ height: 8, borderRadius: 999, background: "#e2e8f0", overflow: "hidden" }}>
              <div style={{ width: `${((currentCapabilityIndex + 1) / Math.max(capabilitySequence.length, 1)) * 100}%`, height: "100%", background: "linear-gradient(90deg, #4f46e5, #7c3aed)" }} />
            </div>
            <div className="meta">You are moving through one capability area at a time. The interview will guide progression automatically based on your responses.</div>
          </>
        ) : null}
      </section>

      <section className="card grid interview-sticky-controls">
        {errorMessage ? <div className="meta" style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", padding: 12, borderRadius: 12, fontSize: 13 }}>Error: {errorMessage}</div> : null}
        {showCompleteConfirm ? (
          <div className="interview-inline-callout">
            <strong>Complete interview?</strong>
            <p className="meta" style={{ margin: "6px 0 10px 0" }}>Use this only when you believe the interview is finished. Scoring will begin after completion.</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="button" onClick={() => { setShowCompleteConfirm(false); void completeInterview(); }} disabled={completionBusy}>{completionBusy ? "Completing..." : "Yes, complete interview"}</button>
              <button className="button ghost" onClick={() => setShowCompleteConfirm(false)}>Cancel</button>
            </div>
          </div>
        ) : null}
        {interview?.status === "completed" ? (
          <div className="interview-inline-callout interview-inline-callout-success">
            <strong>Interview completed</strong>
            <p className="meta" style={{ margin: "6px 0 10px 0" }}>Your report is being prepared. Open the report below, or refresh if scoring is still in progress.</p>
            {jobId ? <p className="meta" style={{ margin: "0 0 10px 0" }}>Scoring job: {jobId}</p> : null}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="button" onClick={() => void loadInterview()}>Refresh status</button>
              <Link href={`/interview/${interviewId}/results`} className="button" style={{ textDecoration: "none" }} onClick={() => stopActiveAudio()}>View report</Link>
              <Link href={`/interview/${interviewId}/results/print`} className="button ghost" style={{ textDecoration: "none" }} onClick={() => stopActiveAudio()}>Open print / PDF view</Link>
            </div>
          </div>
        ) : null}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="button" style={{ boxShadow: readyToRecord ? "0 0 0 4px rgba(79,70,229,0.18), 0 0 24px rgba(79,70,229,0.28)" : undefined, transform: readyToRecord ? "translateY(-1px)" : undefined, background: readyToRecord ? "linear-gradient(90deg, #4f46e5, #7c3aed)" : undefined, borderColor: readyToRecord ? "#4f46e5" : undefined }} onClick={() => void startRecording()} disabled={recordingState === "recording" || recordingState === "processing"}>{recordingState === "recording" ? "Recording..." : "Start recording"}</button>
          <button className="button" style={{ background: recordingState === "recording" ? "#dc2626" : undefined, borderColor: recordingState === "recording" ? "#dc2626" : undefined }} onClick={stopRecording} disabled={recordingState !== "recording"}>Stop and submit</button>
          <button className="button ghost" onClick={replayLastQuestion} disabled={recordingState === "processing"}>Replay question</button>
          <button className="button ghost" onClick={() => setInputMode((m) => (m === "voice" ? "text" : "voice"))}>Use {inputMode === "voice" ? "text fallback" : "voice mode"}</button>
          <button className="button ghost" onClick={() => setShowCompleteConfirm(true)} disabled={recordingState === "recording" || recordingState === "processing" || completionBusy || interview?.status === "completed"}>{completionBusy ? "Completing..." : interview?.status === "completed" ? "Interview completed" : "Complete interview"}</button>
        </div>
        {!supportsRecording ? <div className="meta">Browser recording is unavailable here, so text fallback is enabled.</div> : null}
        {interview?.status === "completed" && !jobId ? <div className="meta">This interview has already been completed. You can review the report below.</div> : null}
        <div className="meta" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {recordingState === "recording" ? <span style={{ width: 10, height: 10, borderRadius: 999, background: "#dc2626", display: "inline-block" }} /> : null}
          <span>{recordingNotice}</span>
          {speakingMessageId && recordingState === "idle" ? <span>Starting your answer will stop playback.</span> : null}
          {readyToRecord && recordingState === "idle" ? <strong style={{ color: "#4f46e5" }}>You can answer now.</strong> : null}
          {recordingState === "recording" ? <strong style={{ marginLeft: "auto" }}>{Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, "0")}</strong> : null}
        </div>
      </section>

      <section className="card grid">
        <div className="chatWrap" ref={chatWrapRef}>
          {messages.map((message) => (
            <div key={message.id} className={`bubble ${message.role === "user" ? "user" : "assistant"}`}>
              <div className="meta" style={{ marginBottom: 4 }}>
                {message.role === "user" ? "Participant" : message.role === "assistant" ? "Interviewer" : "System"}
                {message.capability ? ` · ${message.capability}` : ""}
              </div>
              {message.role === "assistant" && speakingMessageId === message.id
                ? splitIntoSentences(message.transcript_text).map((sentence, index) => (
                    <span
                      key={`${message.id}-${index}`}
                      className={index === speakingSentenceIndex ? "spoken-sentence spoken-sentence-active" : "spoken-sentence"}
                    >
                      {sentence}{" "}
                    </span>
                  ))
                : message.transcript_text}
            </div>
          ))}
        </div>

        {pausePromptVisible ? (
          <div className="card" style={{ borderColor: "#cbd5e1", background: "#fff7ed" }}>
            <strong>Still answering?</strong>
            <p className="meta" style={{ margin: "6px 0 0 0" }}>If you need a moment, that’s fine. If you’ve finished, press Stop and submit when you’re ready.</p>
          </div>
        ) : null}

        <div className="meta">Tip: the conversation will keep moving downward as new messages appear. If you miss the latest question, use Replay question before answering.</div>

        {inputMode === "text" ? (
          <div style={{ display: "flex", gap: 8 }}>
            <input className="input" value={content} onChange={(e) => setContent(e.target.value)} placeholder="Type your answer here if voice is unavailable or inconvenient..." />
            <button className="button" onClick={() => void sendTextMessage(content, "text")} disabled={!content.trim()}>Send</button>
          </div>
        ) : null}
      </section>
    </main>
  );
}
