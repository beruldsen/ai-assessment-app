import type { Capability } from "@/lib/capabilityFramework";

export type BehaviouralLevel = 1 | 2 | 3 | 4 | 5;

export type CapabilityRubric = {
  definition: string;
  testsFor: string[];
  coreQuestion: string;
  probes: string[];
  goodEvidence: string[];
  weakEvidence: string[];
};

export const INTERVIEW_RUBRIC: Record<Capability, CapabilityRubric> = {
  "Business Value Discovery & Co-Creation": {
    definition: "Leads with curiosity, uncovers root business problems, and connects technical capabilities to measurable business outcomes.",
    testsFor: ["depth of curiosity", "business impact thinking", "reframing", "co-creation"],
    coreQuestion: "Tell me about a time you helped a customer move from a technical requirement to a broader business outcome.",
    probes: [
      "What was the original problem versus the real problem?",
      "What questions did you ask and why?",
      "How did you uncover the business impact?",
      "What changed in the customer's thinking?",
      "What was the measurable result?",
    ],
    goodEvidence: ["describes a questioning process", "references business metrics", "shows reframing from feature to value"],
    weakEvidence: ["jumps straight to solution", "stays at feature level", "cannot describe outcome"],
  },
  "Customer & Internal Influence / Collaboration": {
    definition: "Aligns stakeholders, influences without authority, resolves conflict, and drives coordinated progress.",
    testsFor: ["stakeholder alignment", "influence", "ownership", "conflict resolution"],
    coreQuestion: "Describe a situation where you had to align multiple stakeholders to move an opportunity forward.",
    probes: [
      "Who were the stakeholders?",
      "What conflict or tension existed?",
      "What did you do personally to influence?",
      "What obstacles did you remove?",
      "What was the outcome?",
    ],
    goodEvidence: ["active orchestration", "clear ownership", "decision movement"],
    weakEvidence: ["passive observer", "defers to others", "no visible impact"],
  },
  "Executive Communication, Storytelling & Presence": {
    definition: "Simplifies complexity, adapts to audience, and handles challenge with confidence and credibility.",
    testsFor: ["clarity", "audience adaptation", "presence", "composure under pressure"],
    coreQuestion: "Tell me about a time you had to explain something complex to a senior or non-technical audience.",
    probes: [
      "How did you simplify the issue?",
      "What did you change for that audience?",
      "What questions or pushback came up?",
      "How did you handle them?",
      "What was the result?",
    ],
    goodEvidence: ["simplifies clearly", "tailors communication", "maintains control under challenge"],
    weakEvidence: ["uses jargon", "does not adapt", "becomes defensive or vague"],
  },
  "Strategic Account Thinking": {
    definition: "Thinks beyond the immediate deal, anticipates risks, and shapes long-term account direction.",
    testsFor: ["long-term thinking", "risk anticipation", "strategic contribution", "expansion mindset"],
    coreQuestion: "Describe a time you contributed to shaping the direction of an account or opportunity.",
    probes: [
      "What was the bigger picture?",
      "What risks did you identify?",
      "What did you do early?",
      "How did you influence strategy?",
      "What was the longer-term impact?",
    ],
    goodEvidence: ["forward planning", "anticipates blockers", "links short-term action to longer-term value"],
    weakEvidence: ["purely reactive", "focused only on immediate ask", "no strategic contribution"],
  },
  "AI Fluency & Human Trust Advantage": {
    definition: "Uses AI to improve effectiveness while maintaining judgment, credibility, and trust.",
    testsFor: ["practical AI usage", "judgment", "trust balance", "responsible use"],
    coreQuestion: "Tell me about how you've used AI to improve your effectiveness in a customer or sales situation.",
    probes: [
      "What tools did you use?",
      "How did it change your approach?",
      "What decisions did you make versus the AI?",
      "What risks or limitations did you notice?",
      "What was the impact on the outcome?",
    ],
    goodEvidence: ["specific practical use", "critical thinking", "balanced judgment"],
    weakEvidence: ["no real usage", "blind reliance", "generic commentary"],
  },
  "Technical Credibility & Continuous Learning": {
    definition: "Applies deep technical knowledge credibly and keeps learning from customers, ecosystem, and experience.",
    testsFor: ["technical depth", "applied expertise", "learning mindset", "real-world relevance"],
    coreQuestion: "Tell me about a time where your technical expertise made a critical difference.",
    probes: [
      "What was technically complex?",
      "What did you diagnose or solve?",
      "How did you explain it?",
      "How did others respond?",
      "What did you learn?",
    ],
    goodEvidence: ["applied expertise", "technical clarity", "continuous learning"],
    weakEvidence: ["surface-level knowledge", "no impact", "cannot articulate learning"],
  },
};

export const INTERVIEW_SCORE_SCALE: Record<BehaviouralLevel, string> = {
  1: "No real example, largely theoretical",
  2: "Weak, vague, limited ownership",
  3: "Solid but inconsistent depth",
  4: "Strong, clear ownership and outcomes",
  5: "Exceptional, strategic, influential, high impact",
};

export const CROSS_RESPONSE_PATTERNS = [
  "solution-first vs discovery-led",
  "feature-focused vs business-focused",
  "passive vs ownership-driven",
  "reactive vs strategic",
  "technical-only vs balanced",
  "AI-dependent vs AI-augmented",
  "confidence masking lack of depth",
] as const;
