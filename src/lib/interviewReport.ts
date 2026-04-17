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

export type InterviewReport = {
  overallRating: string;
  overallAverage: number;
  headlineInsight: string;
  topStrengths: string[];
  topDevelopmentPriorities: string[];
  behaviouralInsights: string[];
  strengthsProfile: string[];
  developmentPlan: {
    startDoing: string[];
    stopDoing: string[];
    doMoreOf: string[];
  };
  managerCoachingGuide: {
    supportActions: string[];
    coachingQuestions: string[];
    liveDealObservations: string[];
  };
  capabilityBreakdown: Array<{
    capability: string;
    score: number;
    level: string;
    evidence: string;
    strengths: string[];
    gaps: string[];
    benchmark: string;
    impactStatement: string;
    behaviouralPatterns: string[];
    coachingRecommendations: string[];
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

function benchmarkForCapability(capability: string) {
  switch (capability as Capability) {
    case "Business Value Discovery & Co-Creation":
      return "Strong SEs uncover the real business problem, quantify value, and co-create success criteria rather than staying at feature level.";
    case "Customer & Internal Influence / Collaboration":
      return "Strong SEs actively orchestrate stakeholders, influence without authority, and create decision movement across internal and customer groups.";
    case "Executive Communication, Storytelling & Presence":
      return "Strong SEs adapt to senior audiences, translate complexity into business relevance, and maintain credibility under challenge.";
    case "Strategic Account Thinking":
      return "Strong SEs think beyond the immediate deal, anticipate risks early, and shape longer-term account direction.";
    case "AI Fluency & Human Trust Advantage":
      return "Strong SEs use AI with judgement, validate outputs carefully, and combine speed with trust and credibility.";
    case "Technical Credibility & Continuous Learning":
      return "Strong SEs do more than demonstrate technical competence. They proactively build new capability, stay ahead of change, and apply fresh learning to improve customer and business outcomes.";
    default:
      return "Strong SEs show clear behavioural evidence, not just polished language or generic claims.";
  }
}

function impactStatement(capability: string, score: number) {
  const level = capabilityLevel(score);
  switch (capability as Capability) {
    case "Business Value Discovery & Co-Creation":
      return level === "Strong" || level === "Exceptional"
        ? "This suggests the individual can elevate customer conversations from product need to business value and help shape stronger opportunities."
        : "This suggests customer conversations may stay too close to surface requirements, limiting value creation and differentiation.";
    case "Customer & Internal Influence / Collaboration":
      return level === "Strong" || level === "Exceptional"
        ? "This suggests the individual can create alignment across stakeholders and help opportunities move with less drift and fewer avoidable blockers."
        : "This suggests stakeholder complexity may slow momentum, with too much reliance on others to create alignment or resolve tension.";
    case "Executive Communication, Storytelling & Presence":
      return level === "Strong" || level === "Exceptional"
        ? "This suggests the individual can engage senior audiences effectively and translate complexity into credible decision-oriented conversations."
        : "This suggests technical credibility may not yet convert into executive clarity, confidence, or influence in high-stakes conversations.";
    case "Strategic Account Thinking":
      return level === "Strong" || level === "Exceptional"
        ? "This suggests the individual can shape account direction beyond immediate deal support and contribute to longer-term growth and risk reduction."
        : "This suggests the individual may operate too reactively, missing chances to shape account direction or spot downstream risk early.";
    case "AI Fluency & Human Trust Advantage":
      return level === "Strong" || level === "Exceptional"
        ? "This suggests the individual can use AI to improve leverage while preserving judgement, trust, and customer confidence."
        : "This suggests AI use may be inconsistent, overly generic, or insufficiently tied to judgement and trust in customer-facing work.";
    case "Technical Credibility & Continuous Learning":
      return level === "Strong" || level === "Exceptional"
        ? "This suggests the individual is not only technically credible, but also evolves their capability proactively and applies new knowledge in ways that improve outcomes."
        : "This suggests technical capability may be more static than adaptive, with limited evidence of proactive learning translated into customer or business impact.";
    default:
      return "This reflects the likely impact of the observed behaviour in real customer situations.";
  }
}

export function buildInterviewReport(scores: InterviewScoreRecord[]): InterviewReport {
  const orderedScores = CAPABILITIES
    .map((capability) => scores.find((s) => s.capability === capability))
    .filter((item): item is InterviewScoreRecord => Boolean(item));

  const average = orderedScores.length
    ? Number((orderedScores.reduce((sum, item) => sum + item.score, 0) / orderedScores.length).toFixed(2))
    : 0;

  const sortedHigh = [...orderedScores].sort((a, b) => b.score - a.score);
  const sortedLow = [...orderedScores].sort((a, b) => a.score - b.score);
  const behaviouralInsights = Array.from(new Set(orderedScores.flatMap((s) => toList(s.behavioural_patterns))));

  const headlineInsight = sortedHigh.length && sortedLow.length
    ? `${sortedHigh[0].capability} is currently the clearest relative strength, while ${sortedLow[0].capability} is the highest-value development priority.`
    : "Interview evidence is still being generated.";

  const topStrengths = sortedHigh.slice(0, 3).map((item) => `${item.capability} (${capabilityLevel(item.score)})`);
  const topDevelopmentPriorities = sortedLow.slice(0, 3).map((item) => `${item.capability} (${capabilityLevel(item.score)})`);

  const strengthsProfile = sortedHigh.slice(0, 3).map((item) => {
    const strengths = toList(item.strengths);
    return strengths[0] ? `${item.capability}: ${strengths[0]}` : `${item.capability}: evidence suggests this is currently one of the individual’s more reliable strengths.`;
  });

  const developmentAreas = sortedLow.flatMap((item) => toList(item.development_areas).slice(0, 1));
  const coaching = sortedLow.flatMap((item) => toList(item.coaching_recommendations).slice(0, 1));

  return {
    overallRating: overallRating(average),
    overallAverage: average,
    headlineInsight,
    topStrengths,
    topDevelopmentPriorities,
    behaviouralInsights: behaviouralInsights.length ? behaviouralInsights : ["No strong cross-capability behavioural patterns detected yet."],
    strengthsProfile,
    developmentPlan: {
      startDoing: coaching.slice(0, 3).length ? coaching.slice(0, 3) : ["Choose one priority capability and practise the target behaviour in live customer situations each week."],
      stopDoing: developmentAreas.slice(0, 3).length ? developmentAreas.slice(0, 3).map((item) => `Stop defaulting to this pattern: ${item}`) : ["Stop relying on polished but non-specific examples when stronger behavioural evidence is needed."],
      doMoreOf: sortedHigh.slice(0, 3).map((item) => `Do more of the behaviours already visible in ${item.capability}.`),
    },
    managerCoachingGuide: {
      supportActions: sortedLow.slice(0, 3).map((item) => `Create deliberate coaching and live-practice opportunities in ${item.capability}.`),
      coachingQuestions: [
        "What did you do personally, and what changed because of it?",
        "Where are you still relying on technical explanation instead of shaping the customer decision?",
        "What capability do you need to build next to stay ahead in your role?",
      ],
      liveDealObservations: [
        "Observe whether they lead with business value or technical detail.",
        "Watch how they handle stakeholder tension and whether they create real movement.",
        "Look for evidence of proactive learning being applied in live customer situations.",
      ],
    },
    capabilityBreakdown: orderedScores.map((item) => {
      const tone = scoreTone(item.score);
      const defaultStrengths = tone === "strong"
        ? ["Consistently demonstrates a high-value Sales Engineering behaviour in this capability."]
        : [];
      const defaultGaps = tone === "mid"
        ? ["Would benefit from more consistency, sharper examples, and stronger transfer into live strategic situations."]
        : tone === "low"
          ? ["Needs clearer, more repeatable evidence of this capability in live customer and deal situations."]
          : [];
      const defaultRecommendations = tone === "strong"
        ? ["Leverage this strength more deliberately in strategic customer conversations, mentoring, and complex deal shaping."]
        : tone === "mid"
          ? ["Practice this capability more intentionally in live opportunities, with explicit reflection on what worked and what to improve."]
          : ["Prioritize this area in manager coaching, role-play, and live deal observation with clear behavioural checkpoints."];

      return {
        capability: item.capability,
        score: item.score,
        level: capabilityLevel(item.score),
        evidence: item.evidence_summary ?? "No evidence summary available.",
        strengths: toList(item.strengths).length ? toList(item.strengths) : defaultStrengths,
        gaps: toList(item.development_areas).length ? toList(item.development_areas) : defaultGaps,
        benchmark: benchmarkForCapability(item.capability),
        impactStatement: impactStatement(item.capability, item.score),
        behaviouralPatterns: toList(item.behavioural_patterns),
        coachingRecommendations: toList(item.coaching_recommendations).length ? toList(item.coaching_recommendations) : defaultRecommendations,
      };
    }),
  };
}
