import { z } from "zod";
import { openai } from "../openai";
import { supabase } from "../supabase";

const stringList = z.union([z.array(z.string()), z.string()]).transform((value) => {
  if (Array.isArray(value)) return value;
  return value
    .split(/\n|;|•|-/)
    .map((item) => item.trim())
    .filter(Boolean);
});

const scoreSchema = z.object({
  capability: z.string(),
  score: z.number().min(1).max(5),
  evidence_summary: z.string().default(""),
  strengths: stringList.default([]),
  development_areas: stringList.default([]),
  behavioural_patterns: stringList.default([]),
  coaching_recommendations: stringList.default([]),
});

const resultSchema = z.object({
  capabilities: z.array(scoreSchema),
  overall_summary: z.string().default(""),
});

const INTERVIEW_SCORE_SCALE = {
  1: "No evidence, theoretical or generic only",
  2: "Weak evidence, vague with low ownership or shallow impact",
  3: "Solid evidence, clear example with partial depth",
  4: "Strong evidence, clear ownership, judgement, and meaningful outcome",
  5: "Exceptional evidence, strategic judgement, influence, and measurable impact",
} as const;

const CROSS_RESPONSE_PATTERNS = [
  "solution-first vs discovery-led",
  "feature-focused vs business-focused",
  "passive vs ownership-driven",
  "reactive vs strategic",
  "technical-only vs balanced",
  "AI-dependent vs AI-augmented",
  "confidence masking lack of depth",
  "polished but shallow",
  "team masking vs personal ownership",
  "strategic language without behaviour",
  "detail without business impact",
] as const;

const INTERVIEW_RUBRIC = {
  "Business Value Discovery & Co-Creation": {
    definition: "Leads with curiosity, uncovers root business problems, and connects technical capabilities to measurable business outcomes.",
    testsFor: ["depth of curiosity", "business impact thinking", "reframing", "co-creation", "discovery before solutioning", "measurable value"],
    goodEvidence: ["describes a questioning process", "references business metrics", "shows reframing from feature to value", "does not rush to solution", "uses discovery to reshape the conversation", "defines success in measurable terms"],
    weakEvidence: ["jumps straight to solution", "stays at feature level", "cannot describe outcome", "treats discovery as shallow qualification only", "uses business language without concrete evidence"],
    scoreAnchors: {
      1: "No real example. Stays theoretical or generic.",
      2: "Weak example. Some discovery language, but little ownership, little depth, and no clear business outcome.",
      3: "Solid example. Shows real discovery behaviour and some value orientation, but limited depth, weak co-creation, or only partial measurable impact.",
      4: "Strong example. Clearly reframes the problem, shows personal ownership, links technical discussion to business value, and influences success criteria or decision quality.",
      5: "Exceptional example. Reshapes the customer’s understanding of the problem, co-creates measurable value, influences strategic direction, and creates clear business impact.",
    },
  },
  "Customer & Internal Influence / Collaboration": {
    definition: "Aligns stakeholders, influences without authority, resolves conflict, and drives coordinated progress.",
    testsFor: ["stakeholder alignment", "influence", "ownership", "conflict resolution", "multi-threading", "sales partnership", "decision movement"],
    goodEvidence: ["active orchestration", "clear ownership", "decision movement", "maps power and influence", "shows partnership rather than dependency", "handles pushback constructively"],
    weakEvidence: ["passive observer", "defers to others", "no visible impact", "cannot distinguish stakeholders from decision makers", "describes collaboration without influence"],
    scoreAnchors: {
      1: "No real example. Talks abstractly about teamwork or collaboration.",
      2: "Weak example. Vague stakeholder picture, low ownership, and little evidence of influence or movement.",
      3: "Solid example. Shows some ownership and stakeholder awareness, but limited depth, weak conflict handling, or modest impact.",
      4: "Strong example. Demonstrates clear ownership, sound stakeholder judgement, effective influence without authority, and visible progress or alignment.",
      5: "Exceptional example. Shifts complex stakeholder dynamics, creates alignment across competing interests, and materially changes the direction or outcome of the opportunity.",
    },
  },
  "Executive Communication, Storytelling & Presence": {
    definition: "Simplifies complexity, adapts to audience, and handles challenge with confidence and credibility.",
    testsFor: ["clarity", "audience adaptation", "presence", "composure under pressure", "storytelling", "room reading", "executive relevance"],
    goodEvidence: ["simplifies clearly", "tailors communication", "maintains control under challenge", "shows message discipline", "makes software or complexity feel relevant and engaging", "adapts in real time"],
    weakEvidence: ["uses jargon", "does not adapt", "becomes defensive or vague", "shows too much detail without clear value", "mistakes smooth delivery for influence"],
    scoreAnchors: {
      1: "No real example. Generic claims about communication style only.",
      2: "Weak example. Some attempt to simplify, but little adaptation, limited presence, and no clear evidence of audience impact.",
      3: "Solid example. Communicates clearly and shows some audience adaptation, but limited depth under challenge or only modest influence on the outcome.",
      4: "Strong example. Tailors the message well, handles challenge credibly, reads the room, and improves executive understanding or alignment.",
      5: "Exceptional example. Shapes senior stakeholder thinking in real time, combines clarity with presence, and materially influences direction, confidence, or decision quality.",
    },
  },
  "Strategic Account Thinking": {
    definition: "Thinks beyond the immediate deal, anticipates risks, and shapes long-term account direction.",
    testsFor: ["long-term thinking", "risk anticipation", "strategic contribution", "expansion mindset", "customer success orientation", "account hypothesis"],
    goodEvidence: ["forward planning", "anticipates blockers", "links short-term action to longer-term value", "shows account-level judgment", "acts on a strategic hypothesis"],
    weakEvidence: ["purely reactive", "focused only on immediate ask", "no strategic contribution", "cannot connect action to longer-term outcome", "speaks strategically without behavioural evidence"],
    scoreAnchors: {
      1: "No real example. Talks about strategy in the abstract.",
      2: "Weak example. Mostly reactive, limited foresight, and little evidence of shaping account direction.",
      3: "Solid example. Shows some forward thinking and risk awareness, but limited influence on the broader account approach.",
      4: "Strong example. Anticipates risks, connects current actions to longer-term outcomes, and influences the account approach in a meaningful way.",
      5: "Exceptional example. Demonstrates strategic judgement that materially improves account direction, stakeholder sequencing, or long-term value creation.",
    },
  },
  "AI Fluency & Human Trust Advantage": {
    definition: "Uses AI to improve effectiveness while maintaining judgment, credibility, and trust.",
    testsFor: ["practical AI usage", "judgment", "trust balance", "responsible use", "augmentation not replacement", "validation discipline"],
    goodEvidence: ["specific practical use", "critical thinking", "balanced judgment", "treats AI as leverage rather than a crutch", "validates before acting"],
    weakEvidence: ["no real usage", "blind reliance", "generic commentary", "treats AI output as truth without verification", "describes efficiency without judgement"],
    scoreAnchors: {
      1: "No real example. Talks generally about AI without actual use.",
      2: "Weak example. Superficial usage, little validation, and weak evidence of judgement or trust awareness.",
      3: "Solid example. Shows practical usage and some validation, but limited depth on judgement, risk, or stakeholder trust.",
      4: "Strong example. Uses AI purposefully, validates carefully, and balances efficiency with human judgement and credibility.",
      5: "Exceptional example. Demonstrates mature AI judgement, strong validation discipline, and clear trust-preserving use that improves business or customer outcomes.",
    },
  },
  "Technical Credibility & Continuous Learning": {
    definition: "Proactively builds technical capability, stays ahead of relevant trends, and applies new knowledge in ways that improve customer outcomes, business value, and technical credibility.",
    testsFor: ["curiosity", "learning agility", "proactive capability development", "application of new knowledge", "business-linked technical judgement", "continuous evolution"],
    goodEvidence: ["proactively identifies learning needs", "shows active learning behaviour", "applies learning quickly", "links learning to customer or business impact", "demonstrates ongoing curiosity and evolution"],
    weakEvidence: ["generic statements about staying current", "describes learning without application", "passive learning only", "overly technical explanation without business relevance", "no clear impact from the learning"],
    scoreAnchors: {
      1: "No evidence. Generic statements about learning or staying current, with no real example.",
      2: "Weak example. Some learning activity is described, but it is mostly passive, vague, or disconnected from real application and impact.",
      3: "Solid example. Clear evidence of learning and some real application, but limited proactivity, speed, or business impact.",
      4: "Strong example. Proactively builds new capability, applies it in a real situation, and improves customer confidence, decision quality, or business outcome.",
      5: "Exceptional example. Anticipates or spots a learning need early, rapidly builds meaningful capability, applies it to create clear customer or business impact, and shows ongoing curiosity and continuous evolution.",
    },
  },
} as const;

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
    : Object.keys(INTERVIEW_RUBRIC).join(", ");

  const rubricText = Object.entries(INTERVIEW_RUBRIC)
    .map(([capability, rubric]) => [
      `Capability: ${capability}`,
      `Definition: ${rubric.definition}`,
      `Tests for: ${rubric.testsFor.join(", ")}`,
      `Good evidence: ${rubric.goodEvidence.join(", ")}`,
      `Weak evidence: ${rubric.weakEvidence.join(", ")}`,
      `Score anchors: ${Object.entries(rubric.scoreAnchors).map(([k, v]) => `${k}=${v}`).join(" | ")}`,
    ].join("\n"))
    .join("\n\n");

  const system = [
    "You are scoring a Sales Engineer behavioural interview.",
    "Use the interview-specific rubric rigorously and score only observable behavioural evidence from the transcript.",
    "Capabilities in scope:",
    capabilityList,
    "Global 1-5 score scale:",
    ...Object.entries(INTERVIEW_SCORE_SCALE).map(([k, v]) => `- ${k} = ${v}`),
    "Mandatory scoring rules:",
    "- Score each capability independently, not by overall impression.",
    "- Reward only evidence of real past behaviour, not polished language or confidence.",
    "- Distinguish clearly between individual contribution and team contribution.",
    "- Distinguish activity from decision quality, stakeholder movement, and outcome.",
    "- Penalise vague, theoretical, rehearsed, or generic answers.",
    "- Penalise missing ownership, missing outcomes, missing decision logic, and weak stakeholder evidence.",
    "- Use only interview evidence, not inferred seniority or brand prestige.",
    `Cross-response behavioural patterns to consider where supported by evidence: ${CROSS_RESPONSE_PATTERNS.join(", ")}`,
    "For each capability, produce:",
    "- capability",
    "- score",
    "- evidence_summary",
    "- strengths",
    "- development_areas",
    "- behavioural_patterns",
    "- coaching_recommendations",
    "Evidence summary should explain what the candidate actually demonstrated and what evidence was missing.",
    "Strengths and development areas should be practical and evidence-based.",
    "Behavioural patterns should use short labels only when clearly supported by the transcript.",
    "Coaching recommendations should be specific, practical, and directly tied to observed gaps.",
    "Return JSON only with one item per capability plus an overall summary.",
    "Detailed rubric:",
    rubricText,
  ].join("\n");

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: `Interview transcript:\n${transcript}\n\nReturn JSON of the form {\"capabilities\":[...],\"overall_summary\":\"...\"}. Ensure every capability in scope is scored exactly once.`,
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
