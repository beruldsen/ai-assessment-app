"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { CAPABILITIES, INTERVIEW_PROMPTS, capabilityIntro, type Capability } from "@/lib/capabilityFramework";

type Message = { id: string; sender: "user" | "assistant"; content: string };

function uuid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function InterviewPage() {
  const params = useParams<{ interviewId: string }>();
  const interviewId = params?.interviewId;

  const [capabilityIndex, setCapabilityIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [messages, setMessages] = useState<Message[]>([
    { id: uuid(), sender: "assistant", content: capabilityIntro(CAPABILITIES[0]) },
    { id: uuid(), sender: "assistant", content: INTERVIEW_PROMPTS[CAPABILITIES[0]][0] },
  ]);
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("running");

  const currentCapability = CAPABILITIES[capabilityIndex];
  const prompts = useMemo(() => INTERVIEW_PROMPTS[currentCapability], [currentCapability]);

  function followUp(answer: string, capability: Capability) {
    const lc = answer.toLowerCase();
    if (!lc.includes("result") && !lc.includes("outcome")) return "What was the measurable result or business outcome?";
    if (!lc.includes("i ")) return "What exactly did you do personally in that situation?";
    if (lc.length < 140) return `Can you give me a more specific example related to ${capability}?`;
    return "What would you do differently if you handled that situation again?";
  }

  function sendMessage() {
    if (!content.trim()) return;
    const answer = content.trim();
    const updated = [...messages, { id: uuid(), sender: "user", content: answer }];
    const nextQuestionIndex = questionIndex + 1;

    if (nextQuestionIndex < prompts.length) {
      updated.push({ id: uuid(), sender: "assistant", content: followUp(answer, currentCapability) });
      setQuestionIndex(nextQuestionIndex);
    } else if (capabilityIndex < CAPABILITIES.length - 1) {
      const nextCapability = CAPABILITIES[capabilityIndex + 1];
      updated.push({ id: uuid(), sender: "assistant", content: capabilityIntro(nextCapability) });
      updated.push({ id: uuid(), sender: "assistant", content: INTERVIEW_PROMPTS[nextCapability][0] });
      setCapabilityIndex((i) => i + 1);
      setQuestionIndex(0);
    } else {
      updated.push({ id: uuid(), sender: "assistant", content: "Thank you. The interview is complete. Your evidence and scores can now be integrated into the shared assessment dashboard." });
      setStatus("completed");
    }

    setMessages(updated);
    setContent("");
  }

  return (
    <main className="page grid">
      <div>
        <h1 className="title">Behavioural Interview</h1>
        <p className="subtitle">Interview ID: {interviewId}</p>
        <span className="badge">Status: {status}</span>
      </div>

      <section className="card grid">
        <strong>Current capability</strong>
        <p className="meta">{currentCapability}</p>
      </section>

      <section className="card grid">
        <div className="chatWrap">
          {messages.map((message) => (
            <div key={message.id} className={`bubble ${message.sender === "user" ? "user" : "assistant"}`}>
              <div className="meta" style={{ marginBottom: 4 }}>{message.sender === "user" ? "You" : "Interviewer"}</div>
              {message.content}
            </div>
          ))}
        </div>

        {status !== "completed" ? (
          <div style={{ display: "flex", gap: 8 }}>
            <input className="input" value={content} onChange={(e) => setContent(e.target.value)} placeholder="Share a real example..." />
            <button className="button" onClick={sendMessage} disabled={!content.trim()}>Send</button>
          </div>
        ) : null}
      </section>
    </main>
  );
}
