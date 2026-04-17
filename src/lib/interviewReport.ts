import { CAPABILITIES, type Capability } from "@/lib/capabilityFramework";
import { scoreTone } from "@/lib/interviewReportUi";

export type InterviewScoreRecord = {
  capability: string;
  score: number;
  evidence_summary: string | null;
  strengths: string[] | null;
  development_areas: string[] | null;
  behavioural_patterns: string[] | null;
  coaching_recommendations: string[] | null;
};

export type InterviewMessageRecord = {
  capability: string | null;
  role: string;
  transcript_text: string | null;
};

export type InterviewReport = {
  overallRating: string;
  overallAverage: number;
  executiveSummary: string[];
  topStrengths: string[];
  topDevelopmentPriorities: string[];
  capabilityBreakdown: Array<{
    capability: string;
    score: number;
    level: string;
    signalLabel: string;
    summary: string;
    strengths: string[];
    gaps: string[];
    nextStep: string;
  }>;
};

function toList(value: string[] | null | undefined) {
  return (value ?? []).filter(Boolean);
}

function capabilityLevel(score: number) {
  if (score >= 4.5) return "Exceptional";
  if (score > 3.5) return "Strong";
  if (score >= 3) return "Solid";
  if (score >= 2) return "Developing";
  return "Early";
}

function overallRating(avg: number) {
  if (avg >= 4.5) return "Exceptional";
  if (avg > 3.5) return "Strong";
  if (avg >= 3) return "Solid";
  return "Developing";
}

function joinShort(items: string[], max = 2) {
  return items.slice(0, max).join(" ");
}

function firstSentence(text: string | null | undefined) {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const match = clean.match(/.*?[.!?](\s|$)/);
  return (match ? match[0] : clean).trim();
}

function signalLabel(score: number) {
  const tone = scoreTone(score);
  if (tone === "strong") return "Clear, repeatable behavioural evidence";
  if (tone === "mid") return "Some evidence, but not yet consistent";
  return "Limited or insufficient behavioural depth";
}

function salesLens(capability: string) {
  switch (capability as Capability) {
    case "Business Value Discovery & Co-Creation":
      return "business value thinking and value co-creation";
    case "Customer & Internal Influence / Collaboration":
      return "customer influence and stakeholder alignment";
    case "Executive Communication, Storytelling & Presence":
      return "executive communication and commercial clarity";
    case "Strategic Account Thinking":
      return "strategic account judgement and commercial foresight";
    case "AI Fluency & Human Trust Advantage":
      return "AI judgement, trust, and customer-facing credibility";
    case "Technical Credibility & Continuous Learning":
      return "technical credibility linked to business impact";
    default:
      return "Sales Engineering capability";
  }
}

function getParticipantEvidence(messages: InterviewMessageRecord[], capability: string) {
  return messages
    .filter((message) => message.role === "user" && message.capability === capability && message.transcript_text)
    .map((message) => String(message.transcript_text ?? "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function buildSummary(capability: string, score: number, evidenceSummary: string, participantEvidence: string[]) {
  const tone = scoreTone(score);
  const lens = salesLens(capability);
  const exampleHint = participantEvidence[0]
    ? participantEvidence[0].toLowerCase().includes("stakeholder")
      ? "Examples pointed to real stakeholder handling."
      : participantEvidence[0].toLowerCase().includes("business") || participantEvidence[0].toLowerCase().includes("value")
        ? "Examples showed a commercial framing rather than purely technical explanation."
        : "Interview examples showed some practical application in real situations."
    : "Interview examples were limited.";

  if (tone === "strong") {
    return `${signalLabel(score)} in ${lens}. ${firstSentence(evidenceSummary) || "The participant showed strong, commercially relevant behaviour."} ${exampleHint}`.trim();
  }
  if (tone === "mid") {
    return `${signalLabel(score)} in ${lens}. ${firstSentence(evidenceSummary) || "The participant showed relevant capability, but not yet at a consistently strong level."} ${exampleHint}`.trim();
  }
  return `${signalLabel(score)} in ${lens}. ${firstSentence(evidenceSummary) || "The interview did not provide enough convincing evidence in this area."} ${exampleHint}`.trim();
}

function normalizeBullets(items: string[], fallback: string[]) {
  const trimmed = items.map((item) => item.replace(/\s+/g, " ").trim()).filter(Boolean);
  return trimmed.length ? trimmed.slice(0, 3) : fallback;
}

function defaultStrengths(score: number, capability: string) {
  const tone = scoreTone(score);
  if (tone === "strong") {
    switch (capability as Capability) {
      case "Business Value Discovery & Co-Creation":
        return ["Reframes technical needs into business problems.", "Connects discovery to value and decision quality."];
      case "Customer & Internal Influence / Collaboration":
        return ["Creates stakeholder movement across the account.", "Shows ownership rather than passive coordination."];
      case "Executive Communication, Storytelling & Presence":
        return ["Translates complexity into business-relevant language.", "Handles senior conversations with composure."];
      case "Strategic Account Thinking":
        return ["Looks beyond the immediate deal.", "Spots longer-term commercial risk and opportunity."];
      case "AI Fluency & Human Trust Advantage":
        return ["Uses AI with judgement rather than dependence.", "Balances speed with trust and credibility."];
      case "Technical Credibility & Continuous Learning":
        return ["Builds capability proactively.", "Applies learning in customer-facing situations."];
    }
  }
  return ["Relevant behavioural signal was present." ];
}

function defaultGaps(score: number, capability: string) {
  const tone = scoreTone(score);
  if (tone === "mid") {
    return ["Make the behaviour more consistent under pressure.", "Use clearer business impact and decision consequences in examples."];
  }
  if (tone === "low") {
    switch (capability as Capability) {
      case "Business Value Discovery & Co-Creation":
        return ["Move beyond technical description into commercial diagnosis.", "Show clearer evidence of value co-creation with the customer."];
      case "Customer & Internal Influence / Collaboration":
        return ["Show stronger stakeholder orchestration and conflict handling.", "Demonstrate more visible ownership of account movement."];
      case "Executive Communication, Storytelling & Presence":
        return ["Lead with executive relevance, not detail.", "Show stronger message control and business framing."];
      case "Strategic Account Thinking":
        return ["Show clearer long-term account judgement.", "Connect actions to expansion, risk, or sequencing impact."];
      case "AI Fluency & Human Trust Advantage":
        return ["Demonstrate clearer AI use tied to business outcomes.", "Show stronger validation discipline and judgement."];
      case "Technical Credibility & Continuous Learning":
        return ["Show more proactive learning behaviour.", "Connect technical growth more clearly to customer impact."];
    }
  }
  return ["Behavioural depth could be stronger."];
}

function defaultNextStep(score: number, capability: string) {
  const tone = scoreTone(score);
  if (tone === "strong") return `Use this capability more deliberately in complex, customer-facing situations where it can shape deal quality and strategic confidence.`;
  if (tone === "mid") return `Focus on making this capability more repeatable in live opportunities, with clearer business impact and stronger behavioural specificity.`;
  return `Prioritise this as a development area through targeted coaching, live observation, and deliberate practice in real Sales Engineering scenarios.`;
}

export function buildInterviewReport(scores: InterviewScoreRecord[], messages: InterviewMessageRecord[] = []): InterviewReport {
  const orderedScores = CAPABILITIES
    .map((capability) => scores.find((s) => s.capability === capability))
    .filter((item): item is InterviewScoreRecord => Boolean(item));

  const average = orderedScores.length
    ? Number((orderedScores.reduce((sum, item) => sum + item.score, 0) / orderedScores.length).toFixed(2))
    : 0;

  const sortedHigh = [...orderedScores].sort((a, b) => b.score - a.score);
  const sortedLow = [...orderedScores].sort((a, b) => a.score - b.score);

  const capabilityBreakdown = orderedScores.map((item) => {
    const participantEvidence = getParticipantEvidence(messages, item.capability);
    const strengths = normalizeBullets(toList(item.strengths), defaultStrengths(item.score, item.capability));
    const gaps = normalizeBullets(toList(item.development_areas), defaultGaps(item.score, item.capability));
    const nextStep = (toList(item.coaching_recommendations)[0] || defaultNextStep(item.score, item.capability)).replace(/\s+/g, " ").trim();

    return {
      capability: item.capability,
      score: item.score,
      level: capabilityLevel(item.score),
      signalLabel: signalLabel(item.score),
      summary: buildSummary(item.capability, item.score, item.evidence_summary ?? "", participantEvidence),
      strengths,
      gaps,
      nextStep,
    };
  });

  const topStrengths = capabilityBreakdown
    .filter((row) => scoreTone(row.score) === "strong")
    .slice(0, 3)
    .map((row) => `${row.capability} (${row.level})`);

  const topDevelopmentPriorities = capabilityBreakdown
    .filter((row) => scoreTone(row.score) !== "strong")
    .slice(0, 3)
    .map((row) => `${row.capability} (${row.level})`);

  const executiveSummary = [
    sortedHigh[0] ? `Strongest evidence sits in ${sortedHigh[0].capability}, where the participant showed the clearest commercially relevant behavioural depth.` : null,
    sortedLow[0] ? `Biggest gap sits in ${sortedLow[0].capability}, where the interview examples were least convincing or least repeatable.` : null,
    topStrengths.length ? `Key strengths: ${topStrengths.join(", ")}.` : null,
    topDevelopmentPriorities.length ? `Primary focus areas: ${topDevelopmentPriorities.join(", ")}.` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  return {
    overallRating: overallRating(average),
    overallAverage: average,
    executiveSummary,
    topStrengths,
    topDevelopmentPriorities,
    capabilityBreakdown,
  };
}
