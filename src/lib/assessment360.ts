export type RaterType = "self" | "manager";

export type AssessmentQuestion = {
  id: string;
  dimension: string;
  text: string;
};

export const ASSESSMENT_360_QUESTIONS: AssessmentQuestion[] = [
  {
    id: "curiosity_discovery",
    dimension: "Curiosity",
    text: "Asks focused discovery questions to uncover root causes.",
  },
  {
    id: "value_outcomes",
    dimension: "Value Discovery",
    text: "Connects technical recommendations to measurable business outcomes.",
  },
  {
    id: "presence_executive",
    dimension: "Executive Presence",
    text: "Communicates clearly and confidently with executive audiences.",
  },
  {
    id: "influence_orchestration",
    dimension: "Influence",
    text: "Aligns cross-functional stakeholders toward a clear next step.",
  },
  {
    id: "ownership_followthrough",
    dimension: "Commercial Ownership",
    text: "Owns commitments and follows through to business outcomes.",
  },
  {
    id: "planning_account",
    dimension: "Strategic Planning",
    text: "Helps shape account/opportunity plans beyond immediate technical tasks.",
  },
  {
    id: "commercial_acumen",
    dimension: "Commercial Acumen",
    text: "Engages comfortably in ROI, risk, and value trade-off discussions.",
  },
  {
    id: "ai_trust",
    dimension: "AI + Trust",
    text: "Uses AI to improve quality/speed while maintaining human trust and judgment.",
  },
];
