export const DOMAINS = [
  "Curiosity",
  "Value Discovery",
  "Executive Presence",
  "Influence",
  "Commercial Ownership",
] as const;

export type Domain = (typeof DOMAINS)[number];

export type EvidenceStrength = "strong" | "moderate" | "weak";
