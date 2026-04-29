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
  redirectCount?: number;
  evidenceScore?: number;
  strategicSignals?: string[];
  participantResistance?: boolean;
  participantResistanceReason?: string;
  reusedCrossCapabilityEvidence?: boolean;
  missingDimensions?: string[];
  contextualReference?: string;
};

const MIN_USER_TURNS_PER_CAPABILITY = 2;
const MAX_USER_TURNS_PER_CAPABILITY = 5;
const MIN_EVIDENCE_SCORE_TO_ADVANCE = 5;
const MAX_OFF_TARGET_REDIRECTS = 3;
const MAX_PARTICIPANT_RESISTANCE_BEFORE_ADVANCE = 2;

const CAPABILITY_KEYWORDS: Record<Capability, string[]> = {
  "Business Value Discovery & Co-Creation": ["business outcome", "value", "metrics", "adoption", "forecast", "ramp", "problem", "discovery"],
  "Customer & Internal Influence / Collaboration": ["stakeholders", "align", "alignment", "conflict", "influence", "procurement", "legal", "security", "collaboration"],
  "Executive Communication, Storytelling & Presence": ["executive", "simplified", "senior audience", "non-technical", "story", "visual", "pushback", "presentation"],
  "Strategic Account Thinking": ["strategic", "account", "roadmap", "expansion", "long-term", "risk", "transformation", "stakeholder sequencing"],
  "AI Fluency & Human Trust Advantage": ["ai", "llm", "prompt", "automation", "summarize", "judgment", "trust", "verify"],
  "Technical Credibility & Continuous Learning": ["learned", "learning", "get up to speed", "new technology", "new domain", "stayed ahead", "stay ahead", "capability", "applied it", "applied that learning", "used again", "since then", "curiosity", "evolving"],
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
    "decision changed",
    "moved forward",
    "adoption",
    "pipeline",
    "time to value",
    "agreed",
    "aligned",
    "approved",
    "bought in",
    "stayed engaged",
    "moved ahead",
    "evaluate",
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
    "i built",
    "i explained",
    "i simplified",
    "i adapted",
    "i shifted",
    "i positioned",
    "i framed",
    "i watched",
  ].some((token) => lc.includes(token));
}

function hasSpecificity(text: string) {
  return text.trim().length >= 180;
}

function hasDecisionLogicEvidence(text: string) {
  const lc = text.toLowerCase();
  return [
    "because",
    "so that",
    "i chose",
    "i decided",
    "the reason",
    "my rationale",
    "trade-off",
    "constraint",
  ].some((token) => lc.includes(token));
}

function hasStakeholderEvidence(text: string) {
  const lc = text.toLowerCase();
  return [
    "stakeholder",
    "executive",
    "customer",
    "buyer",
    "procurement",
    "legal",
    "architect",
    "cfo",
    "cio",
    "vp",
    "team",
  ].some((token) => lc.includes(token));
}

function hasReflectionEvidence(text: string) {
  const lc = text.toLowerCase();
  return [
    "learned",
    "next time",
    "would do differently",
    "in hindsight",
    "since then",
  ].some((token) => lc.includes(token));
}

function strategicSignals(text: string) {
  const lc = text.toLowerCase();
  const signalMap: Array<[string, string[]]> = [
    ["hypothesis", ["hypothesis", "assumption", "working theory"]],
    ["bigger_picture", ["bigger picture", "broader", "long-term", "strategic", "account dynamic"]],
    ["risk_anticipation", ["risk", "blocker", "barrier", "consequence", "downstream"]],
    ["stakeholder_map", ["stakeholder", "decision maker", "influence", "sequencing", "sponsor"]],
    ["change_of_tack", ["changed tack", "reframed", "changed approach", "pivoted"]],
    ["expansion_or_future", ["expansion", "roadmap", "future", "next phase", "longer-term"]],
  ];

  return signalMap
    .filter(([, needles]) => needles.some((token) => lc.includes(token)))
    .map(([label]) => label);
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
    hasDecisionLogicEvidence(text),
    hasStakeholderEvidence(text),
    hasReflectionEvidence(text),
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

function missingEvidenceDimensions(capability: Capability, text: string, probeIndex = 0) {
  const missing: string[] = [];

  if (capability === "Strategic Account Thinking") {
    const signals = strategicSignals(text);
    if (!signals.includes("hypothesis")) missing.push("account hypothesis");
    if (!signals.includes("bigger_picture")) missing.push("bigger-picture account view");
    if (!signals.includes("risk_anticipation")) missing.push("risk anticipation");
  }

  if (!hasOwnershipEvidence(text)) missing.push("personal ownership");
  if (!hasOutcomeEvidence(text)) missing.push("business outcome");
  if (!hasDecisionLogicEvidence(text)) missing.push("decision-making rationale");
  if (!hasStakeholderEvidence(text)) missing.push("stakeholder influence");
  if (!hasReflectionEvidence(text) && probeIndex >= 2) missing.push("reflection or learning");

  return Array.from(new Set(missing));
}

function buildProbeForMissingDimension(capability: Capability, dimension: string) {
  switch (dimension) {
    case "account hypothesis":
      return "What was your working hypothesis about the account, and what evidence led you to that view?";
    case "bigger-picture account view":
      return "What bigger picture account dynamic did you see that others were missing?";
    case "risk anticipation":
      return "What longer-term risk, blocker, or consequence were you trying to get ahead of?";
    case "personal ownership":
      return "What did you personally do versus what the team did?";
    case "business outcome":
      return "What changed in the business, stakeholder decision, or opportunity because of your actions?";
    case "decision-making rationale":
      return "Why did you choose that approach rather than another option?";
    case "stakeholder influence":
      return capability === "Strategic Account Thinking"
        ? "Who did you need to influence, and how did that affect the account direction?"
        : "Who did you need to influence, and how did they respond?";
    case "reflection or learning":
      return "What did you learn, or what would you do differently next time?";
    default:
      return "What was the measurable result?";
  }
}

function nextProbe(capability: Capability, probeIndex: number, text?: string) {
  const rubric = INTERVIEW_RUBRIC[capability];
  const participantAnswer = text ?? "";

  if (participantAnswer) {
    const missing = missingEvidenceDimensions(capability, participantAnswer, probeIndex);
    if (missing.length) return buildProbeForMissingDimension(capability, missing[0] ?? "");
  }

  if (probeIndex >= rubric.probes.length && rubric.hardToFakeProbes.length) {
    return rubric.hardToFakeProbes[(probeIndex - rubric.probes.length) % rubric.hardToFakeProbes.length] ?? "What was the measurable result?";
  }

  return rubric.probes[Math.min(probeIndex, rubric.probes.length - 1)] ?? "What was the measurable result?";
}

function detectParticipantResistance(text: string) {
  const lc = text.toLowerCase();
  const phrases = [
    "i already told you",
    "i already did",
    "i already answered",
    "i said that already",
    "we covered that",
    "already covered",
    "no thank you",
    "i don't care",
    "move on",
    "next question",
    "stop asking",
  ];

  const matched = phrases.find((phrase) => lc.includes(phrase));
  return {
    resistant: Boolean(matched),
    reason: matched ?? null,
  };
}

function contextualReferencePrefix(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return null;

  const lc = normalized.toLowerCase();
  if (lc.includes("manufacturing")) return "In that manufacturing example,";
  if (lc.includes("cio")) return "In the CIO example,";
  if (lc.includes("finance lead") || lc.includes("finance")) return "In the example with the finance lead,";
  if (lc.includes("operations vp")) return "In the operations VP conversation,";
  if (lc.includes("value model")) return "In the value-model example,";
  if (lc.includes("plant manager")) return "When you described aligning the plant manager and executive stakeholders,";
  if (lc.includes("stakeholder") || lc.includes("executive")) return "In the example you described with those stakeholders,";

  const firstSentence = normalized.split(/(?<=[.!?])\s+/)[0] ?? normalized;
  const shortSentence = firstSentence.length > 140 ? `${firstSentence.slice(0, 137).trim()}...` : firstSentence;
  return `Earlier you mentioned: "${shortSentence}"`;
}

function buildNaturalReuseLead(reference: string | null, variantSeed = 0) {
  if (!reference) return null;
  const options = [
    `${reference} staying with that same situation,`,
    `${reference} building on that,`,
    `${reference} staying with that example,`,
  ];
  return options[variantSeed % options.length] ?? `${reference} staying with that example,`;
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
  const currentScore = CAPABILITY_KEYWORDS[capability].filter((token) => text.toLowerCase().includes(token.toLowerCase())).length;
  return {
    fitAccepted: detected === null ? true : detected === capability || currentScore >= 1,
    detectedCapability: detected,
  };
}

function redirectForCapability(current: Capability, detected: Capability | null) {
  const currentProbe = INTERVIEW_RUBRIC[current].probes[0];
  if (detected && detected !== current) {
    return `I can hear elements of ${detected} in that example as well. To assess ${current}, stay with the same situation and help me understand the ${INTERVIEW_RUBRIC[current].testsFor.slice(0, 2).join(" and ")} you saw. ${currentProbe}`;
  }
  return `Stay with ${current}. Use one specific past example and focus on what you personally did, why you did it, who you influenced, and what changed. ${currentProbe}`;
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

    const [capabilityHistoryRes, fullHistoryRes] = await Promise.all([
      supabaseServer
        .from("interview_messages")
        .select("role, transcript_text, capability, metadata, created_at")
        .eq("interview_id", interviewId)
        .eq("capability", capability)
        .order("created_at", { ascending: true }),
      supabaseServer
        .from("interview_messages")
        .select("role, transcript_text, capability, metadata, created_at")
        .eq("interview_id", interviewId)
        .order("created_at", { ascending: true }),
    ]);

    const capabilityHistory = capabilityHistoryRes.data ?? [];
    const fullHistory = fullHistoryRes.data ?? [];

    if (capabilityHistoryRes.error) {
      return NextResponse.json({ error: capabilityHistoryRes.error.message }, { status: 500 });
    }
    if (fullHistoryRes.error) {
      return NextResponse.json({ error: fullHistoryRes.error.message }, { status: 500 });
    }

    const fit = assessCapabilityFit(capability, content);
    const resistance = detectParticipantResistance(content);
    const allAssistantMessages = capabilityHistory.filter((m) => m.role === "assistant");
    const offTargetRedirects = allAssistantMessages.filter(
      (m) => (m.metadata as Metadata | null)?.fitReason === "redirected-to-current-capability"
    ).length;
    const userMessages = capabilityHistory.filter((m) => m.role === "user" && (m.metadata as Metadata | null)?.fitAccepted !== false);
    const priorResistanceCount = capabilityHistory.filter((m) => m.role === "user" && Boolean((m.metadata as Metadata | null)?.participantResistance)).length;
    const priorAcceptedMessages = fullHistory.filter((m) => m.role === "user" && (m.metadata as Metadata | null)?.fitAccepted !== false);
    const priorCrossCapabilityMessages = priorAcceptedMessages.filter((m) => m.capability && m.capability !== capability);
    const crossCapabilityContext = priorCrossCapabilityMessages
      .map((m) => m.transcript_text)
      .join("\n");
    const latestCrossCapabilityMessage = [...priorCrossCapabilityMessages].reverse()[0]?.transcript_text ?? null;
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
        participantResistance: resistance.resistant,
        participantResistanceReason: resistance.reason ?? undefined,
      } satisfies Metadata,
    });

    if (insertUserErr) {
      return NextResponse.json({ error: insertUserErr.message }, { status: 500 });
    }

    let assistant = "";
    let responseCapability = capability;
    const answerEvidenceScore = evidenceScore(capability, content);
    const combinedCapabilityText = [...userMessages.map((m) => m.transcript_text), content].join("\n");
    const combinedCrossCapabilityText = [crossCapabilityContext, combinedCapabilityText].filter(Boolean).join("\n");
    const missingDimensions = missingEvidenceDimensions(capability, combinedCrossCapabilityText, probeIndex + 1);
    const crossCapabilityEvidenceScore = crossCapabilityContext ? evidenceScore(capability, combinedCrossCapabilityText) : 0;
    const contextualReference = latestCrossCapabilityMessage ? contextualReferencePrefix(latestCrossCapabilityMessage) : null;
    let responseMetadata: Metadata = {
      outputMode: body?.outputMode ?? "voice",
      evidenceScore: Math.max(answerEvidenceScore, crossCapabilityEvidenceScore),
      strategicSignals: capability === "Strategic Account Thinking" ? strategicSignals(content) : undefined,
      reusedCrossCapabilityEvidence: crossCapabilityEvidenceScore > answerEvidenceScore,
      missingDimensions,
      contextualReference: contextualReference ?? undefined,
    };

    if (resistance.resistant) {
      const next = nextCapability(interview, capability);
      const resistanceCount = priorResistanceCount + 1;

      if (next && resistanceCount >= MAX_PARTICIPANT_RESISTANCE_BEFORE_ADVANCE) {
        responseCapability = next;
        assistant = `Understood. We have enough to move on from this area. ${INTERVIEW_RUBRIC[next].coreQuestion} ${INTERVIEW_RUBRIC[next].probes[0]}`;
        responseMetadata = {
          ...responseMetadata,
          completedCapability: true,
          transitionTo: next,
          probeIndex: 0,
          fitAccepted: true,
          forcedAdvance: true,
          participantResistance: true,
          participantResistanceReason: resistance.reason ?? undefined,
        };
      } else {
        assistant = "Understood. We can move on when needed, but before we do, give me one concrete example focused just on what you personally did, how you adapted for the audience, and what changed as a result.";
        responseMetadata = {
          ...responseMetadata,
          probeIndex: probeIndex + 1,
          fitAccepted: true,
          participantResistance: true,
          participantResistanceReason: resistance.reason ?? undefined,
        };
      }
    } else if (!fit.fitAccepted) {
      const next = nextCapability(interview, capability);
      const shouldForceAdvance = offTargetRedirects + 1 >= MAX_OFF_TARGET_REDIRECTS;

      if (shouldForceAdvance && next) {
        responseCapability = next;
        assistant = `We have given this area a few tries, so I’m going to move us on. ${INTERVIEW_RUBRIC[next].coreQuestion} ${INTERVIEW_RUBRIC[next].probes[0]}`;
        responseMetadata = {
          ...responseMetadata,
          completedCapability: true,
          transitionTo: next,
          probeIndex: 0,
          fitAccepted: false,
          fitReason: "forced-advance-after-off-target-answers",
          detectedCapability: fit.detectedCapability,
          forcedAdvance: true,
          redirectCount: offTargetRedirects + 1,
        };
      } else {
        assistant = redirectForCapability(capability, fit.detectedCapability);
        responseMetadata = {
          ...responseMetadata,
          fitAccepted: false,
          fitReason: "redirected-to-current-capability",
          detectedCapability: fit.detectedCapability,
          probeIndex,
          redirectCount: offTargetRedirects + 1,
        };
      }
    } else {
      const updatedUserAnswers = [...userMessages.map((m) => m.transcript_text), content];
      const readyToAdvance = capabilityReadyToAdvance(capability, updatedUserAnswers) || crossCapabilityEvidenceScore >= MIN_EVIDENCE_SCORE_TO_ADVANCE;
      const shouldForceAdvance = updatedUserAnswers.length >= MAX_USER_TURNS_PER_CAPABILITY;

      if (readyToAdvance || shouldForceAdvance) {
        const next = nextCapability(interview, capability);
        if (next) {
          responseCapability = next;
          const transitionLead = crossCapabilityEvidenceScore >= MIN_EVIDENCE_SCORE_TO_ADVANCE
            ? buildNaturalReuseLead(contextualReference, probeIndex) ?? "Staying with that same example,"
            : "";
          assistant = shouldForceAdvance && !readyToAdvance
            ? `${transitionLead ? `${transitionLead} ` : ""}Thank you, that gives me enough context for this area. Let’s move on. ${INTERVIEW_RUBRIC[next].coreQuestion} ${INTERVIEW_RUBRIC[next].probes[0]}`
            : `${transitionLead ? `${transitionLead} ` : ""}${INTERVIEW_RUBRIC[next].coreQuestion} ${INTERVIEW_RUBRIC[next].probes[0]}`;
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
        const missingDimension = missingDimensions[0] ?? null;
        const missingDimensionProbe = missingDimension ? buildProbeForMissingDimension(capability, missingDimension) : null;
        assistant = missingDimensionProbe ?? nextProbe(capability, probeIndex, content);
        const naturalLead = responseMetadata.reusedCrossCapabilityEvidence
          ? buildNaturalReuseLead(contextualReference, probeIndex)
          : null;
        if (resistance.resistant && missingDimensionProbe) {
          assistant = `${naturalLead ? `${naturalLead} ` : ""}I heard that. I just need one more detail on ${missingDimension}. ${missingDimensionProbe}`;
        } else if (missingDimensionProbe) {
          assistant = probeIndex >= 1
            ? `${naturalLead ? `${naturalLead} ` : ""}I just need one more detail on ${missingDimension}. ${missingDimensionProbe}`
            : `${naturalLead ? `${naturalLead} ` : ""}${missingDimensionProbe}`;
        }
        responseMetadata = {
          ...responseMetadata,
          probeIndex: probeIndex + 1,
          fitAccepted: true,
        };

        if (process.env.OPENAI_API_KEY) {
          const system = [
            "You are a senior Sales Engineering leader conducting a structured behavioural interview.",
            "Your style should feel like a credible SE leader, not a generic competency bot.",
            `Current capability: ${capability}.`,
            `Capability definition: ${rubric.definition}`,
            `Tests for: ${rubric.testsFor.join(", ")}`,
            `Good evidence: ${rubric.goodEvidence.join(", ")}`,
            `Weak evidence: ${rubric.weakEvidence.join(", ")}`,
            `Core question: ${rubric.coreQuestion}`,
            `Current recommended probe: ${assistant}`,
            `Missing dimensions still to assess: ${missingDimensions.join(", ") || "none"}`,
            `Evidence ladder for this capability: ${rubric.evidenceLadder.join(" | ")}`,
            `Hard-to-fake probes for this capability: ${rubric.hardToFakeProbes.join(" | ")}`,
            `Scoring anchors: ${Object.entries(rubric.scoreAnchors).map(([k, v]) => `${k}=${v}`).join(" | ")}`,
            "Interviewer behaviors to emulate:",
            "- Push for discovery quality, not just activity. Ask how they knew, what they asked, or why they took that view.",
            "- Look for proactive ownership. Ask what they did personally, not what the team or company did.",
            "- Test whether they understand stakeholder reality, including influence versus decision authority.",
            "- For communication answers, test audience adaptation, message discipline, and whether they read the room.",
            "- For technical answers, connect technical judgment to business consequence, trust, or deal movement.",
            "- For AI answers, test judgment, validation, and trust, not just tool usage.",
            "- If the participant is vague, politely force specificity: one situation, one action, one result.",
            "- Actively challenge polished but shallow answers, team masking, strategic language without behaviour, and technical detail without business impact.",
            "- Prefer questions that expose whether they led with business value or jumped too quickly to solution or feature detail.",
            "Rules:",
            "- Stay strictly on the current capability, but recognize that strong answers may overlap with adjacent capabilities.",
            "- Reuse evidence from earlier answers when it is relevant to the current capability. Do not force the participant to retell the same story unless a specific missing dimension still needs evidence.",
            "- When referencing a prior answer, mention the actual situation, stakeholder, or example the participant described. Avoid generic phrases like 'you already shared an example' unless there is no better contextual reference.",
            "- Vary the language used to build on prior answers so it feels natural rather than templated.",
            "- If an answer partly fits the current capability, do not reject it outright. Briefly acknowledge the relevant part and ask only for the missing evidence needed for this capability.",
            "- If the participant signals they already answered, do not restate the original question. Ask only for the missing dimension, or move on if enough evidence already exists.",
            "- When a follow-up is needed after prior evidence exists, briefly justify it in one short sentence.",
            "- Ask one concise probing question only.",
            "- Use natural spoken language, not competency-framework jargon.",
            "- Avoid stacked multi-part questions unless tightly connected.",
            "- Push for a real past example, personal ownership, decision logic, stakeholder movement, and measurable outcome.",
            "- Do not move to a new capability yet.",
            "- Do not sound argumentative, binary, or dismissive when redirecting.",
            "- Do not praise the participant, summarize their answer, or coach them toward the answer.",
            "- Do not reward confidence or fluency unless backed by specific behavioural evidence.",
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

    const updatePayload: Record<string, unknown> = {};
    if (responseCapability !== capability) {
      updatePayload.current_capability = responseCapability;
    }

    const { error: updateErr } = Object.keys(updatePayload).length
      ? await supabaseServer
          .from("interviews")
          .update(updatePayload)
          .eq("id", interviewId)
      : { error: null };
    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
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
