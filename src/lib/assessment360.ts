export type RaterType = "self" | "manager";

export type AssessmentQuestion = {
  id: string;
  capability: string;
  text: string;
};

type CapabilityBlock = {
  capability: string;
  behaviors: string[];
};

export const ASSESSMENT_180_CAPABILITIES: CapabilityBlock[] = [
  {
    capability: "Technical Credibility & Continuous Learning",
    behaviors: [
      "Demonstrates strong technical understanding of the solution, architecture, and ecosystem.",
      "Applies technical expertise to solve complex customer challenges.",
      "Connects technical capabilities to real customer environments and use cases.",
      "Earns trust with technical stakeholders through clarity, depth, and accuracy.",
      "Stays current on emerging technologies, architectures, and industry developments.",
      "Seeks learning opportunities from customers, colleagues, and experience.",
      "Demonstrates curiosity about how customers use technology in real-world scenarios.",
    ],
  },
  {
    capability: "Business Value Discovery & Co-Creation",
    behaviors: [
      "Uses questioning to explore the customer’s business and technical environment.",
      "Investigates underlying problems rather than accepting surface requirements.",
      "Demonstrates curiosity about the customer’s business strategy and priorities.",
      "Connects technology capabilities to business challenges and outcomes.",
      "Helps customers define measurable success metrics.",
      "Expands discussions from technical requirements to broader business impact.",
      "Collaborates with customers to design solutions that create meaningful value.",
      "Identifies opportunities for new use cases or additional value.",
    ],
  },
  {
    capability: "Customer & Internal Influence / Collaboration",
    behaviors: [
      "Builds strong collaborative relationships across internal teams and customer stakeholders.",
      "Aligns sales, product, services, and success teams around shared objectives.",
      "Influences stakeholders without relying on formal authority.",
      "Encourages alignment on priorities, actions, and next steps.",
      "Helps resolve conflicting perspectives between stakeholders.",
      "Facilitates productive discussions that move opportunities forward.",
    ],
  },
  {
    capability: "Executive Communication, Storytelling & Presence",
    behaviors: [
      "Simplifies complex technical ideas for different audiences.",
      "Communicates with clarity and confidence in meetings and presentations.",
      "Uses stories, examples, or visuals to make ideas memorable.",
      "Adapts communication style based on the audience and context.",
      "Handles unexpected questions or challenges with composure.",
      "Demonstrates presence and credibility in customer interactions.",
    ],
  },
  {
    capability: "Strategic Account Thinking",
    behaviors: [
      "Understands the customer’s strategic priorities and business drivers.",
      "Anticipates potential risks, objections, or barriers to success.",
      "Identifies opportunities for additional value or expansion.",
      "Contributes ideas that shape the account strategy.",
      "Connects short-term activities to long-term account outcomes.",
      "Plans engagement with stakeholders early in the opportunity lifecycle.",
    ],
  },
  {
    capability: "Commercial Acumen & Value Justification",
    behaviors: [
      "Understands the financial and commercial drivers behind customer decisions.",
      "Connects technical solutions to financial or business outcomes.",
      "Articulates ROI, cost implications, and value trade-offs.",
      "Supports the sales team in building a compelling business case.",
      "Demonstrates awareness of pricing, procurement, and risk considerations.",
      "Engages comfortably in value-focused discussions with customers.",
    ],
  },
  {
    capability: "Ownership, Accountability & Value Realization",
    behaviors: [
      "Takes ownership for progressing opportunities and delivering outcomes.",
      "Follows through reliably on commitments across teams.",
      "Takes initiative to remove obstacles or move opportunities forward.",
      "Considers adoption, usage, and long-term value during solution design.",
      "Links solutions to measurable business outcomes and success metrics.",
      "Helps customers understand how value will be realized and sustained.",
      "Supports long-term customer success, expansion opportunities, and renewals.",
    ],
  },
  {
    capability: "AI Fluency & Human Trust Advantage",
    behaviors: [
      "Uses AI tools to enhance research, preparation, and analysis.",
      "Applies judgment when interpreting AI-generated insights.",
      "Uses AI to improve the speed and quality of work.",
      "Uses AI to support discovery, analysis, or customer preparation.",
      "Maintains empathy, credibility, and trust in customer interactions.",
      "Balances AI insights with human context and judgment.",
      "Demonstrates responsible and ethical use of AI tools.",
    ],
  },
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export const ASSESSMENT_360_QUESTIONS: AssessmentQuestion[] = ASSESSMENT_180_CAPABILITIES.flatMap((cap) =>
  cap.behaviors.map((behavior, idx) => ({
    id: `${slugify(cap.capability)}_${idx + 1}`,
    capability: cap.capability,
    text: behavior,
  }))
);
