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
    testsFor: ["depth of curiosity", "business impact thinking", "reframing", "co-creation", "discovery before solutioning"],
    coreQuestion: "Tell me about a time you helped a customer move from an initial request or stated need to a clearer business problem worth solving.",
    probes: [
      "What was the customer's stated need at the start, and why did you think there was more underneath it?",
      "What questions did you ask to separate the surface request from the real business problem?",
      "How did you connect that problem to business value, risk, cost, or strategic impact?",
      "How did you involve the customer in shaping the path forward rather than just presenting an answer?",
      "What changed in the deal, the stakeholder conversation, or the customer's success criteria as a result?",
    ],
    goodEvidence: ["describes a questioning process", "references business metrics", "shows reframing from feature to value", "does not rush to solution", "uses discovery to reshape the conversation"],
    weakEvidence: ["jumps straight to solution", "stays at feature level", "cannot describe outcome", "treats discovery as shallow qualification only"],
  },
  "Customer & Internal Influence / Collaboration": {
    definition: "Aligns stakeholders, influences without authority, resolves conflict, and drives coordinated progress.",
    testsFor: ["stakeholder alignment", "influence", "ownership", "conflict resolution", "multi-threading", "sales partnership"],
    coreQuestion: "Describe a situation where you had to align multiple stakeholders, internally and/or with the customer, to move an opportunity forward.",
    probes: [
      "Who were the real stakeholders, and who had influence versus decision authority?",
      "Where was the tension, misalignment, or risk of drift?",
      "What did you do personally to influence the situation rather than waiting for others to fix it?",
      "How did you work with the account executive or wider team, and what did that partnership look like in practice?",
      "What decision or movement happened because of your intervention?",
    ],
    goodEvidence: ["active orchestration", "clear ownership", "decision movement", "maps power and influence", "shows partnership rather than dependency"],
    weakEvidence: ["passive observer", "defers to others", "no visible impact", "cannot distinguish stakeholders from decision makers"],
  },
  "Executive Communication, Storytelling & Presence": {
    definition: "Simplifies complexity, adapts to audience, and handles challenge with confidence and credibility.",
    testsFor: ["clarity", "audience adaptation", "presence", "composure under pressure", "storytelling", "room reading"],
    coreQuestion: "Tell me about a time you had to explain something complex to a senior, non-technical, or mixed audience and still keep them engaged.",
    probes: [
      "How did you decide what to leave out so you did not overwhelm them with detail?",
      "What did you change in your language, structure, or visuals for that audience?",
      "How did you read the room and notice whether you had them with you or were losing them?",
      "What pushback or challenge came up, and how did you respond without becoming defensive?",
      "What was the result of that communication?",
    ],
    goodEvidence: ["simplifies clearly", "tailors communication", "maintains control under challenge", "shows message discipline", "makes software or complexity feel relevant and engaging"],
    weakEvidence: ["uses jargon", "does not adapt", "becomes defensive or vague", "shows too much detail without clear value"],
  },
  "Strategic Account Thinking": {
    definition: "Thinks beyond the immediate deal, anticipates risks, and shapes long-term account direction.",
    testsFor: ["long-term thinking", "risk anticipation", "strategic contribution", "expansion mindset", "customer success orientation"],
    coreQuestion: "Describe a time you contributed to shaping the direction of an account or opportunity beyond the immediate ask.",
    probes: [
      "What was the bigger picture you saw that others were missing?",
      "What risks, blockers, or downstream consequences did you identify early?",
      "What did you do before those issues became urgent?",
      "How did you influence the account approach, not just react to it?",
      "What longer-term impact did that have on the customer relationship, account, or expansion path?",
    ],
    goodEvidence: ["forward planning", "anticipates blockers", "links short-term action to longer-term value", "shows account-level judgment"],
    weakEvidence: ["purely reactive", "focused only on immediate ask", "no strategic contribution", "cannot connect action to longer-term outcome"],
  },
  "AI Fluency & Human Trust Advantage": {
    definition: "Uses AI to improve effectiveness while maintaining judgment, credibility, and trust.",
    testsFor: ["practical AI usage", "judgment", "trust balance", "responsible use", "augmentation not replacement"],
    coreQuestion: "Tell me about a time you used AI to improve your effectiveness in a customer, sales, or preparation context without giving up your own judgment.",
    probes: [
      "What tool or workflow did you use, and what was the specific job you were trying to improve?",
      "What did the AI do well, and what did you still need to do yourself?",
      "How did you validate, edit, or challenge the output before using it with others?",
      "What trust, accuracy, or credibility risks did you notice?",
      "What changed in the quality, speed, or outcome of your work because of it?",
    ],
    goodEvidence: ["specific practical use", "critical thinking", "balanced judgment", "treats AI as leverage rather than a crutch"],
    weakEvidence: ["no real usage", "blind reliance", "generic commentary", "treats AI output as truth without verification"],
  },
  "Technical Credibility & Continuous Learning": {
    definition: "Applies deep technical knowledge credibly and keeps learning from customers, ecosystem, and experience.",
    testsFor: ["technical depth", "applied expertise", "learning mindset", "real-world relevance", "explains complexity clearly"],
    coreQuestion: "Tell me about a time your technical expertise made a critical difference in a customer or sales situation.",
    probes: [
      "What was technically complex, and why did it matter commercially or operationally?",
      "What did you diagnose, clarify, or solve that others had not yet understood?",
      "How did you explain the issue differently for technical versus non-technical stakeholders?",
      "How did that technical credibility change the customer's confidence or the direction of the deal?",
      "What did you learn that you have used again since then?",
    ],
    goodEvidence: ["applied expertise", "technical clarity", "continuous learning", "links technical judgment to trust and outcome"],
    weakEvidence: ["surface-level knowledge", "no impact", "cannot articulate learning", "describes technical detail without business relevance"],
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
