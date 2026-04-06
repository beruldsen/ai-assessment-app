export const CAPABILITIES = [
  "Business Value Discovery & Co-Creation",
  "Customer & Internal Influence / Collaboration",
  "Executive Communication, Storytelling & Presence",
  "Strategic Account Thinking",
  "AI Fluency & Human Trust Advantage",
  "Technical Credibility & Continuous Learning",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export const CAPABILITY_BEHAVIOURS: Record<Capability, string[]> = {
  "Business Value Discovery & Co-Creation": [
    "Uses questioning to explore the customer's business and technical environment",
    "Investigates underlying problems rather than accepting surface requirements",
    "Connects technology capabilities to business challenges and outcomes",
    "Helps customers define measurable success metrics",
  ],
  "Customer & Internal Influence / Collaboration": [
    "Builds strong collaborative relationships across internal teams and customer stakeholders",
    "Influences stakeholders without relying on formal authority",
    "Facilitates productive discussions that move opportunities forward",
    "Takes initiative to remove obstacles to move opportunities forward",
  ],
  "Executive Communication, Storytelling & Presence": [
    "Simplifies complex technical ideas for different audiences",
    "Communicates with clarity and confidence in meetings and presentations",
    "Uses stories, examples, or visuals to make ideas memorable",
    "Handles unexpected questions or challenges with composure",
  ],
  "Strategic Account Thinking": [
    "Understands the customer's strategic priorities and business drivers",
    "Anticipates potential risks, objections, or barriers to success",
    "Contributes ideas that shape the account strategy",
    "Connects short-term activities to long-term account outcomes",
  ],
  "AI Fluency & Human Trust Advantage": [
    "Uses AI tools to enhance research, preparation, and analysis",
    "Applies judgment when interpreting AI-generated insights",
    "Balances AI insights with human context and judgment",
    "Demonstrates responsible and ethical use of AI tools",
  ],
  "Technical Credibility & Continuous Learning": [
    "Demonstrates strong technical understanding of the solution, architecture, and ecosystem",
    "Applies technical expertise to solve complex customer challenges",
    "Earns trust with technical stakeholders through clarity, depth, and accuracy",
    "Seeks learning opportunities from customers, colleagues, and experience",
  ],
};

export const INTERVIEW_PROMPTS: Record<Capability, string[]> = {
  "Business Value Discovery & Co-Creation": [
    "Tell me about a time you uncovered a business problem that was not obvious at first.",
    "Describe a situation where you helped a customer connect technical possibilities to measurable business value.",
  ],
  "Customer & Internal Influence / Collaboration": [
    "Give me an example of when you had to align multiple stakeholders without formal authority.",
    "Tell me about a time internal or customer priorities conflicted and you had to move the opportunity forward.",
  ],
  "Executive Communication, Storytelling & Presence": [
    "Describe a time you had to explain something technically complex to an executive audience.",
    "Tell me about a moment where you were challenged in a meeting and had to maintain credibility.",
  ],
  "Strategic Account Thinking": [
    "Tell me about a time you influenced account strategy beyond immediate deal support.",
    "Describe a situation where you identified a long-term risk or expansion opportunity early.",
  ],
  "AI Fluency & Human Trust Advantage": [
    "Give me a real example of how you used AI to improve the quality of your work in a sales engineering context.",
    "Tell me about a time when you chose not to rely on AI output and used your own judgment instead.",
  ],
  "Technical Credibility & Continuous Learning": [
    "Describe a time your technical depth materially changed the outcome of a customer conversation.",
    "Tell me about something new you had to learn quickly in order to support a customer effectively.",
  ],
};

export function capabilityIntro(capability: Capability) {
  return `We are now focusing on ${capability}. Please answer using a real example from your experience, and I will probe for specifics using the STAR structure.`;
}
