import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { openai } from "@/lib/openai";
import { INTERVIEW_RUBRIC } from "@/lib/interviewRubric";
import type { Capability } from "@/lib/capabilityFramework";

type Ctx = { params: Promise<{ interviewId: string }> };

type InterviewRecord = {
  id: string;
  status: "running" | "completed" | "failed";
  selected_capabilities: Capability[] | null;
  current_capability: Capability | null;
};

type Metadata = {
  probeIndex?: number;
  completedCapability?: boolean;
  transitionTo?: Capability;
  inputMode?: string;
  outputMode?: string;
  fitAccepted?: boolean;
  fitReason?: string;
  detectedCapability?: Capability | null;
  forcedAdvance?: boolean;
};

const MIN_USER_TURNS_PER_CAPABILITY = 2;
const MAX_USER_TURNS_PER_CAPABILITY = 4;
const MIN_EVIDENCE_SCORE_TO_ADVANCE = 3;

const CAPABILITY_KEYWORDS: Record<Capability, string[]> = {
  "Business Value Discovery & Co-Creation": ["business outcome", "value", "metrics", "adoption", "forecast", "ramp", "problem", "discovery"],
  "Customer & Internal Influence / Collaboration": ["stakeholders", "align", "alignment", "conflict", "influence", "procurement", "legal", "security", "collaboration"],
  "Executive Communication, Storytelling & Presence": ["executive", "simplified", "senior audience", "non-technical", "story", "visual", "pushback", "presentation"],
  "Strategic Account Thinking": ["strategic", "account", "roadmap", "expansion", "long-term", "risk", "transformation", "stakeholder sequencing"],
  "AI Fluency & Human Trust Advantage": ["ai", "llm", "prompt", "automation", "summarize", "judgment", "trust", "verify"],
  "Technical Credibility & Continuous Learning": ["architecture", "integration", "security", "technical", "solution architect", "diagnose", "design", "learn"],
};

function pickCurrentCapability(interview: InterviewRecord): Capability | null {
  if (interview.current_capability) return interview.current_capability;
  return interview.selected_capabilities?.[0] ?? null;
}

function nextCapability(interview: InterviewRecord, current: Capability): Capability | null {
  const caps = interview.selected_capabilities ?? [];
  const idx = caps.indexOf(current);
  if (idx === -1) return null;
  return caps[idx + 1] ?? null;
}

function hasOutcomeEvidence(text: string) {
  const lc = text.toLowerCase();
  return [
    "result",
    "outcome",
    "impact",
    "%",
    "percent",
    "revenue",
    "reduced",
    "reduction",
    "improved",
    "increase",
    "increased",
    "grew",
    "closed",
    "saved",
    "faster",
    "shorter",
    "expanded",
    "regained momentum",
  ].some((token) => lc.includes(token));
}

function hasOwnershipEvidence(text: string) {
  const lc = text.toLowerCase();
  return [
    "i led",
    "i created",
    "i drove",
    "i mapped",
    "i worked",
    "i identified",
    "i reframed",
    "i pushed",
    "i took the lead",
    "i ran",
    "i coached",
    "i helped",
    "i changed my approach",
    "i pulled together",
    "i translated",
    "i realized",
  ].some((token) => lc.includes(token));
}

function hasSpecificity(text: string) {
  return text.trim().length >= 180;
}

function hasCapabilityEvidence(capability: Capability, text: string) {
  const lc = text.toLowerCase();
  const rubricSignals = [
    ...INTERVIEW_RUBRIC[capability].testsFor,
    ...INTERVIEW_RUBRIC[capability].goodEvidence,
    ...CAPABILITY_KEYWORDS[capability],
  ];

  const matches = rubricSignals.filter((signal) => {
    const normalized = signal.toLowerCase();
    return normalized.length > 2 && lc.includes(normalized);
  }).length;

  return matches >= 2;
}

function evidenceScore(capability: Capability, text: string) {
  return [
    hasOutcomeEvidence(text),
    hasOwnershipEvidence(text),
    hasSpecificity(text),
    hasCapabilityEvidence(capability, text),
  ].filter(Boolean).length;
}

function capabilityReadyToAdvance(capability: Capability, userAnswers: string[]) {
  if (userAnswers.length < MIN_USER_TURNS_PER_CAPABILITY) return false;

  const combined = userAnswers.join("\n");
  const latestAnswer = userAnswers[userAnswers.length - 1] ?? "";

  return (
    evidenceScore(capability, combined) >= MIN_EVIDENCE_SCORE_TO_ADVANCE ||
    evidenceScore(capability, latestAnswer) >= MIN_EVIDENCE_SCORE_TO_ADVANCE
  );
}

function nextProbe(capability: Capability, probeIndex: number) {
  const rubric = INTERVIEW_RUBRIC[capability];
  return rubric.probes[Math.min(probeIndex, rubric.probes.length - 1)] ?? "What was the measurable result?";
}

function detectBestMatchingCapability(text: string): Capability | null {
  const lc = text.toLowerCase();
  const scored = (Object.entries(CAPABILITY_KEYWORDS) as [Capability, string[]][])
    .map(([capability, keywords]) => ({
      capability,
      score: keywords.filter((token) => lc.includes(token.toLowerCase())).length,
    }))
    .sort((a, b) => b.score - a.score);

  if (!scored[0] || scored[0].score < 2) return null;
  return scored[0].capability;
}

function assessCapabilityFit(capability: Capability, text: string) {
  const detected = detectBestMatchingCapability(text);
  return {
    fitAccepted: detected === null ? true : detected === capability,
    detectedCapability: detected,
  };
}

function redirectForCapability(current: Capability, detected: Capability | null) {
  const currentProbe = INTERVIEW_RUBRIC[current].probes[0];
  if (detected && detected !== current) {
    return `That example sounds more like ${detected}. For now, stay with ${current}. I’m specifically looking for evidence of ${INTERVIEW_RUBRIC[current].testsFor.slice(0, 2).join(" and ")}. ${currentProbe}`;
  }
  return `Stay with ${current}. Please answer using a concrete example that directly shows this capability. ${currentProbe}`;
}

export async function POST(req: Request, ctx: Ctx) {
  try {
    const { interviewId } = await ctx.params;
    const body = await req.json();
    const content = String(body?.content ?? "").trim();

    if (!interviewId) return NextResponse.json({ error: "interviewId is required" }, { status: 400 });
    if (!content) return NextResponse.json({ error: "content is required" }, { status: 400 });

    const { data: interview, error: interviewErr } = await supabaseServer
      .from("interviews")
      .select("id,status,selected_capabilities,current_capability")
      .eq("id", interviewId)
      .single<InterviewRecord>();

    if (interviewErr || !interview) {
      return NextResponse.json({ error: interviewErr?.message ?? "Interview not found" }, { status: 404 });
    }

    const capability = pickCurrentCapability(interview);
    if (!capability) {
      return NextResponse.json({ error: "Interview has no capability context" }, { status: 400 });
    }

    const rubric = INTERVIEW_RUBRIC[capability];

    const { data: capabilityHistory, error: historyErr } = await supabaseServer
      .from("interview_messages")
      .select("role, transcript_text, capability, metadata, created_at")
      .eq("interview_id", interviewId)
      .eq("capability", capability)
      .order("created_at", { ascending: true });

    if (historyErr) {
      return NextResponse.json({ error: historyErr.message }, { status: 500 });
    }

    const fit = assessCapabilityFit(capability, content);
    const userMessages = (capabilityHistory ?? []).filter((m) => m.role === "user" && (m.metadata as Metadata | null)?.fitAccepted !== false);
    const probeIndex = userMessages.length;

    const { error: insertUserErr } = await supabaseServer.from("interview_messages").insert({
      interview_id: interviewId,
      capability,
      role: "user",
      transcript_text: content,
      metadata: {
        inputMode: body?.inputMode ?? "text",
        probeIndex,
        fitAccepted: fit.fitAccepted,
        fitReason: fit.fitAccepted ? "matched-current-capability" : "off-target-answer",
        detectedCapability: fit.detectedCapability,
      } satisfies Metadata,
    });

    if (insertUserErr) {
      return NextResponse.json({ error: insertUserErr.message }, { status: 500 });
    }

    let assistant = "";
    let responseCapability = capability;
    let responseMetadata: Metadata = { outputMode: body?.outputMode ?? "voice" };

    if (!fit.fitAccepted) {
      assistant = redirectForCapability(capability, fit.detectedCapability);
      responseMetadata = {
        ...responseMetadata,
        fitAccepted: false,
        fitReason: "redirected-to-current-capability",
        detectedCapability: fit.detectedCapability,
        probeIndex,
      };
    } else {
      const updatedUserAnswers = [...userMessages.map((m) => m.transcript_text), content];
      const readyToAdvance = capabilityReadyToAdvance(capability, updatedUserAnswers);
      const shouldForceAdvance = updatedUserAnswers.length >= MAX_USER_TURNS_PER_CAPABILITY;

      if (readyToAdvance || shouldForceAdvance) {
        const next = nextCapability(interview, capability);
        if (next) {
          responseCapability = next;
          assistant = shouldForceAdvance && !readyToAdvance
            ? `Thank you. I have enough to assess ${capability}, even though the evidence is still limited. Let’s move to the next area. ${INTERVIEW_RUBRIC[next].coreQuestion} ${INTERVIEW_RUBRIC[next].probes[0]}`
            : `${INTERVIEW_RUBRIC[next].coreQuestion} ${INTERVIEW_RUBRIC[next].probes[0]}`;
          responseMetadata = {
            ...responseMetadata,
            completedCapability: true,
            transitionTo: next,
            probeIndex: 0,
            fitAccepted: true,
            forcedAdvance: shouldForceAdvance && !readyToAdvance,
          };
        } else {
          assistant = "Thank you. We have now covered the full interview. Please complete the interview so scoring can begin.";
          responseMetadata = {
            ...responseMetadata,
            completedCapability: true,
            fitAccepted: true,
            forcedAdvance: shouldForceAdvance && !readyToAdvance,
          };

          const { error: finalUpdateErr } = await supabaseServer
            .from("interviews")
            .update({ status: "completed", completed_at: new Date().toISOString() })
            .eq("id", interviewId);

          if (finalUpdateErr) {
            return NextResponse.json({ error: finalUpdateErr.message }, { status: 500 });
          }
        }
      } else {
        assistant = nextProbe(capability, probeIndex);
        responseMetadata = {
          ...responseMetadata,
          probeIndex: probeIndex + 1,
          fitAccepted: true,
        };

        if (process.env.OPENAI_API_KEY) {
          const { data: fullHistory } = await supabaseServer
            .from("interview_messages")
            .select("role, transcript_text")
            .eq("interview_id", interviewId)
            .order("created_at", { ascending: true });

          const system = [
            "You are a senior Sales Engineering leader conducting a structured behavioural interview.",
            `Current capability: ${capability}.`,
            `Capability definition: ${rubric.definition}`,
            `Tests for: ${rubric.testsFor.join(", ")}`,
            `Good evidence: ${rubric.goodEvidence.join(", ")}`,
            `Weak evidence: ${rubric.weakEvidence.join(", ")}`,
            `Core question: ${rubric.coreQuestion}`,
            `Current recommended probe: ${assistant}`,
            "Rules:",
            "- Stay strictly on the current capability.",
            "- Ask one concise probing question only.",
            "- Push for a real past example, personal ownership, and measurable outcome.",
            "- Do not move to a new capability yet.",
          ].join("\n");

          const completion = await openai.chat.completions.create({
            model: "gpt-4.1-mini",
            temperature: 0.3,
            max_tokens: 120,
            messages: [
              { role: "system", content: system },
              ...((fullHistory ?? []).map((m) => ({
                role: m.role === "user" ? ("user" as const) : ("assistant" as const),
                content: m.transcript_text,
              })) ?? []),
            ],
          });

          assistant = completion.choices?.[0]?.message?.content?.trim() || assistant;
        }
      }
    }

    const { error: insertAssistantErr } = await supabaseServer.from("interview_messages").insert({
      interview_id: interviewId,
      capability: responseCapability,
      role: "assistant",
      transcript_text: assistant,
      metadata: responseMetadata,
    });

    if (insertAssistantErr) {
      return NextResponse.json({ error: insertAssistantErr.message }, { status: 500 });
    }

    if (responseCapability !== capability) {
      const { error: updateErr } = await supabaseServer
        .from("interviews")
        .update({ current_capability: responseCapability })
        .eq("id", interviewId);
      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      assistant,
      capability: responseCapability,
      fitAccepted: fit.fitAccepted,
      detectedCapability: fit.detectedCapability,
      probeIndex: responseMetadata.probeIndex ?? null,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
