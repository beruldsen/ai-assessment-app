import { z } from "zod";
import { openai } from "../openai";
import { supabase } from "../supabase";

const scoreSchema = z.object({
  capability: z.string(),
  score: z.number().min(1).max(5),
  evidence_summary: z.string(),
  strengths: z.array(z.string()).default([]),
  development_areas: z.array(z.string()).default([]),
  behavioural_patterns: z.array(z.string()).default([]),
  coaching_recommendations: z.array(z.string()).default([]),
});

const resultSchema = z.object({
  capabilities: z.array(scoreSchema),
  overall_summary: z.string().default(""),
});

export async function scoreInterview(args: { interviewId: string }) {
  const { interviewId } = args;

  const { data: interview, error: interviewErr } = await supabase
    .from("interviews")
    .select("id,status,selected_capabilities,current_capability")
    .eq("id", interviewId)
    .single();

  if (interviewErr || !interview) {
    throw new Error(interviewErr?.message ?? "Interview not found");
  }

  const { data: messages, error: messagesErr } = await supabase
    .from("interview_messages")
    .select("capability,role,transcript_text,created_at")
    .eq("interview_id", interviewId)
    .order("created_at", { ascending: true });

  if (messagesErr) {
    throw new Error(messagesErr.message);
  }

  const transcript = (messages ?? [])
    .map((m) => `[${m.capability ?? "General"}] ${m.role.toUpperCase()}: ${m.transcript_text}`)
    .join("\n");

  if (!transcript.trim()) {
    throw new Error("Interview transcript is empty");
  }

  const capabilityList = Array.isArray(interview.selected_capabilities)
    ? interview.selected_capabilities.join(", ")
    : "Business Value Discovery & Co-Creation, Customer & Internal Influence / Collaboration, Executive Communication, Storytelling & Presence, Strategic Account Thinking, AI Fluency & Human Trust Advantage, Technical Credibility & Continuous Learning";

  const system = [
    "You are scoring a Sales Engineer behavioural interview.",
    "Use the interview-specific rubric, but keep scores on a 1-5 scale.",
    "Capabilities in scope:",
    capabilityList,
    "Scoring rules:",
    "- 1 = No real example, largely theoretical",
    "- 2 = Weak, vague, limited ownership",
    "- 3 = Solid but inconsistent depth",
    "- 4 = Strong, clear ownership and outcomes",
    "- 5 = Exceptional, strategic, influential, high impact",
    "Required distinctions:",
    "- theory vs experience",
    "- individual contribution vs team contribution",
    "- activity vs outcome",
    "- confidence vs competence",
    "Return JSON only with one item per capability plus an overall summary.",
  ].join("\n");

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: `Interview transcript:\n${transcript}\n\nReturn JSON of the form {\"capabilities\":[...],\"overall_summary\":\"...\"}`,
      },
    ],
  });

  const raw = completion.choices?.[0]?.message?.content;
  if (!raw) throw new Error("No scoring response returned");

  const parsed = resultSchema.parse(JSON.parse(raw));

  const { error: deleteErr } = await supabase.from("interview_scores").delete().eq("interview_id", interviewId);
  if (deleteErr) throw new Error(deleteErr.message);

  if (parsed.capabilities.length) {
    const { error: insertErr } = await supabase.from("interview_scores").insert(
      parsed.capabilities.map((item) => ({
        interview_id: interviewId,
        capability: item.capability,
        score: item.score,
        evidence_summary: item.evidence_summary,
        strengths: item.strengths,
        development_areas: item.development_areas,
        behavioural_patterns: item.behavioural_patterns,
        coaching_recommendations: item.coaching_recommendations,
      }))
    );

    if (insertErr) throw new Error(insertErr.message);
  }

  return {
    interviewId,
    scoresCreated: parsed.capabilities.length,
    overall_summary: parsed.overall_summary,
  };
}
