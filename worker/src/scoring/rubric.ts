export const DOMAINS = [
  "Curiosity",
  "Value Discovery",
  "Executive Presence",
  "Influence",
  "Commercial Ownership",
] as const;

export type Domain = (typeof DOMAINS)[number];

export type EvidenceStrength = "strong" | "moderate" | "weak";

export const INDICATORS_BY_DOMAIN: Record<Domain, string[]> = {
  Curiosity: [
    "Asks focused discovery questions",
    "Explores root cause before solutioning",
    "Clarifies constraints and success criteria",
  ],
  "Value Discovery": [
    "Connects problem to measurable business outcomes",
    "Quantifies impact or ROI hypothesis",
    "Links technical capability to stakeholder value",
  ],
  "Executive Presence": [
    "Communicates with concise structure",
    "Handles challenge calmly and confidently",
    "Uses clear business language over jargon",
  ],
  Influence: [
    "Aligns stakeholders around next step",
    "Reframes objections into decision criteria",
    "Builds momentum with clear recommendation",
  ],
  "Commercial Ownership": [
    "Drives conversation toward commercial outcomes",
    "Surfaces risk, urgency, and trade-offs",
    "Secures concrete next-step commitment",
  ],
};
