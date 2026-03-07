export type RaterType = "self" | "manager";

export type AssessmentQuestion = {
  id: string;
  dimension: string;
  text: string;
};

export const ASSESSMENT_360_QUESTIONS: AssessmentQuestion[] = [
  {
    id: "curiosity_creativity_agility",
    dimension: "Curiosity, Creativity & Agility",
    text: "Explores root causes with curiosity and adapts approach as new context emerges.",
  },
  {
    id: "value_cocreation",
    dimension: "Business Value Discovery & Co-Creation",
    text: "Co-creates measurable business outcomes with the customer (not just solution fit).",
  },
  {
    id: "influence_collaboration",
    dimension: "Customer & Internal Influence/Collaboration",
    text: "Aligns customer and internal stakeholders toward a shared outcome and next step.",
  },
  {
    id: "presence_storytelling_improv",
    dimension: "Executive Presence, Storytelling & Improvisation",
    text: "Communicates with confidence, simplifies complexity, and adjusts in the moment.",
  },
  {
    id: "strategic_planning",
    dimension: "Strategic Planning & Account Thinking",
    text: "Contributes to account strategy by anticipating risks, stakeholders, and long-term value.",
  },
  {
    id: "ownership_accountability",
    dimension: "Ownership & Accountability",
    text: "Takes ownership of outcomes and follows through on commitments across teams.",
  },
  {
    id: "commercial_acumen",
    dimension: "Commercial Acumen",
    text: "Engages comfortably in ROI, risk, and value trade-off discussions.",
  },
  {
    id: "ai_trust",
    dimension: "AI Fluency + Human Trust Advantage",
    text: "Uses AI to improve quality/speed while strengthening trust, judgment, and empathy.",
  },
];
