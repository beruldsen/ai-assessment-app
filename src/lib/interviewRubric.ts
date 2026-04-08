import type { Capability } from "@/lib/capabilityFramework";

export type BehaviouralLevel = 1 | 2 | 3 | 4 | 5;

export type CapabilityRubric = {
  definition: string;
  testsFor: string[];
  coreQuestion: string;
  probes: string[];
  goodEvidence: string[];
  weakEvidence: string[];
  evidenceLadder: string[];
  hardToFakeProbes: string[];
  scoreAnchors: Record<BehaviouralLevel, string>;
};

export const INTERVIEW_RUBRIC: Record<Capability, CapabilityRubric> = {
  "Business Value Discovery & Co-Creation": {
    definition: "Leads with curiosity, uncovers root business problems, and connects technical capabilities to measurable business outcomes.",
    testsFor: ["depth of curiosity", "business impact thinking", "reframing", "co-creation", "discovery before solutioning", "measurable value"],
    coreQuestion: "Tell me about a time you helped a customer move from an initial request or stated need to a clearer business problem worth solving.",
    probes: [
      "What was the situation, and what made you think the stated need was only part of the problem?",
      "What did you personally do to test that view and uncover the underlying business issue?",
      "What questions or lines of inquiry shifted the conversation from features to business impact?",
      "How did you involve the customer in shaping the problem definition, success criteria, or path forward?",
      "What changed in the customer's thinking, the deal, or the business case because of your work?",
    ],
    goodEvidence: ["describes a questioning process", "references business metrics", "shows reframing from feature to value", "does not rush to solution", "uses discovery to reshape the conversation", "defines success in measurable terms"],
    weakEvidence: ["jumps straight to solution", "stays at feature level", "cannot describe outcome", "treats discovery as shallow qualification only", "uses business language without concrete evidence"],
    evidenceLadder: [
      "What was the situation and what was at stake?",
      "What was your specific responsibility?",
      "What did you personally do?",
      "Why did you choose that approach?",
      "Who did you need to involve or influence?",
      "What changed as a result?",
      "What did you learn or do differently next time?",
      "What output, decision, or artefact came from it?",
    ],
    hardToFakeProbes: [
      "What did you choose not to pursue, and why?",
      "What constraint shaped your discovery approach?",
      "What business metric or success measure changed because of the reframing?",
    ],
    scoreAnchors: {
      1: "No real example. Stays theoretical or generic.",
      2: "Weak example. Some discovery language, but little ownership, little depth, and no clear business outcome.",
      3: "Solid example. Shows real discovery behaviour and some value orientation, but limited depth, weak co-creation, or only partial measurable impact.",
      4: "Strong example. Clearly reframes the problem, shows personal ownership, links technical discussion to business value, and influences success criteria or decision quality.",
      5: "Exceptional example. Reshapes the customer’s understanding of the problem, co-creates measurable value, influences strategic direction, and creates clear business impact.",
    },
  },
  "Customer & Internal Influence / Collaboration": {
    definition: "Aligns stakeholders, influences without authority, resolves conflict, and drives coordinated progress.",
    testsFor: ["stakeholder alignment", "influence", "ownership", "conflict resolution", "multi-threading", "sales partnership", "decision movement"],
    coreQuestion: "Describe a situation where you had to align multiple stakeholders, internally and/or with the customer, to move an opportunity forward.",
    probes: [
      "Who were the key stakeholders, and who had influence versus formal decision authority?",
      "Where was the tension, disagreement, or risk of drift?",
      "What did you personally do to move the situation rather than waiting for others to fix it?",
      "How did you work with the account team or wider team in practice, and where did you need to lead?",
      "What changed in the decision, alignment, or momentum because of your intervention?",
    ],
    goodEvidence: ["active orchestration", "clear ownership", "decision movement", "maps power and influence", "shows partnership rather than dependency", "handles pushback constructively"],
    weakEvidence: ["passive observer", "defers to others", "no visible impact", "cannot distinguish stakeholders from decision makers", "describes collaboration without influence"],
    evidenceLadder: [
      "What was the situation and what was at risk?",
      "What was your specific role in the situation?",
      "What did you personally do to influence progress?",
      "Why did you take that approach?",
      "Who did you need to influence and why?",
      "What changed as a result?",
      "What would you do differently now?",
      "What concrete decision, action, or commitment came out of it?",
    ],
    hardToFakeProbes: [
      "Who pushed back, and how did you handle that?",
      "What did you choose not to escalate, and why?",
      "What changed because of you personally rather than the team generally?",
    ],
    scoreAnchors: {
      1: "No real example. Talks abstractly about teamwork or collaboration.",
      2: "Weak example. Vague stakeholder picture, low ownership, and little evidence of influence or movement.",
      3: "Solid example. Shows some ownership and stakeholder awareness, but limited depth, weak conflict handling, or modest impact.",
      4: "Strong example. Demonstrates clear ownership, sound stakeholder judgement, effective influence without authority, and visible progress or alignment.",
      5: "Exceptional example. Shifts complex stakeholder dynamics, creates alignment across competing interests, and materially changes the direction or outcome of the opportunity.",
    },
  },
  "Executive Communication, Storytelling & Presence": {
    definition: "Simplifies complexity, adapts to audience, and handles challenge with confidence and credibility.",
    testsFor: ["clarity", "audience adaptation", "presence", "composure under pressure", "storytelling", "room reading", "executive relevance"],
    coreQuestion: "Tell me about a time you had to explain something complex to a senior, non-technical, or mixed audience and still keep them engaged.",
    probes: [
      "What mattered most to that audience, and how did you shape the message around that rather than the technical detail?",
      "What did you deliberately leave out or simplify so the message stayed relevant and clear?",
      "How did you adjust in the moment based on how the room was reacting?",
      "What challenge, pushback, or tension came up, and how did you respond without losing credibility?",
      "What changed in the audience’s understanding, confidence, or decision because of that communication?",
    ],
    goodEvidence: ["simplifies clearly", "tailors communication", "maintains control under challenge", "shows message discipline", "makes software or complexity feel relevant and engaging", "adapts in real time"],
    weakEvidence: ["uses jargon", "does not adapt", "becomes defensive or vague", "shows too much detail without clear value", "mistakes smooth delivery for influence"],
    evidenceLadder: [
      "What was the situation and who was the audience?",
      "What was your role in that conversation?",
      "What did you personally do to shape the message?",
      "Why did you choose that framing?",
      "Who did you need to win over or reassure?",
      "What changed as a result?",
      "What did you learn about executive communication from it?",
      "What decision, reaction, or follow-up showed it landed?",
    ],
    hardToFakeProbes: [
      "What happened in the moment that forced you to adapt?",
      "How did you know they were with you, or not with you?",
      "What would the room have misunderstood if you had stayed more technical?",
    ],
    scoreAnchors: {
      1: "No real example. Generic claims about communication style only.",
      2: "Weak example. Some attempt to simplify, but little adaptation, limited presence, and no clear evidence of audience impact.",
      3: "Solid example. Communicates clearly and shows some audience adaptation, but limited depth under challenge or only modest influence on the outcome.",
      4: "Strong example. Tailors the message well, handles challenge credibly, reads the room, and improves executive understanding or alignment.",
      5: "Exceptional example. Shapes senior stakeholder thinking in real time, combines clarity with presence, and materially influences direction, confidence, or decision quality.",
    },
  },
  "Strategic Account Thinking": {
    definition: "Thinks beyond the immediate deal, anticipates risks, and shapes long-term account direction.",
    testsFor: ["long-term thinking", "risk anticipation", "strategic contribution", "expansion mindset", "customer success orientation", "account hypothesis"],
    coreQuestion: "Describe a time you contributed to shaping the direction of an account or opportunity beyond the immediate ask.",
    probes: [
      "What bigger picture or account dynamic did you see that others were missing?",
      "What risks, blockers, or longer-term consequences did you identify early?",
      "What did you personally do before those issues became urgent?",
      "How did you influence the account approach rather than just reacting to it?",
      "What longer-term impact did that have on the account, customer relationship, or expansion path?",
    ],
    goodEvidence: ["forward planning", "anticipates blockers", "links short-term action to longer-term value", "shows account-level judgment", "acts on a strategic hypothesis"],
    weakEvidence: ["purely reactive", "focused only on immediate ask", "no strategic contribution", "cannot connect action to longer-term outcome", "speaks strategically without behavioural evidence"],
    evidenceLadder: [
      "What was the account context and what was at stake?",
      "What was your role in shaping the approach?",
      "What did you personally do to influence direction?",
      "Why did you take that view?",
      "Who did you need to bring with you?",
      "What changed as a result?",
      "What did you learn about strategic account thinking from that situation?",
      "What downstream decision, plan, or account move came out of it?",
    ],
    hardToFakeProbes: [
      "What was your hypothesis about the account, and what evidence supported it?",
      "What changed your view as the situation evolved?",
      "What did you choose not to prioritise, and why?",
    ],
    scoreAnchors: {
      1: "No real example. Talks about strategy in the abstract.",
      2: "Weak example. Mostly reactive, limited foresight, and little evidence of shaping account direction.",
      3: "Solid example. Shows some forward thinking and risk awareness, but limited influence on the broader account approach.",
      4: "Strong example. Anticipates risks, connects current actions to longer-term outcomes, and influences the account approach in a meaningful way.",
      5: "Exceptional example. Demonstrates strategic judgement that materially improves account direction, stakeholder sequencing, or long-term value creation.",
    },
  },
  "AI Fluency & Human Trust Advantage": {
    definition: "Uses AI to improve effectiveness while maintaining judgment, credibility, and trust.",
    testsFor: ["practical AI usage", "judgment", "trust balance", "responsible use", "augmentation not replacement", "validation discipline"],
    coreQuestion: "Tell me about a time you used AI to improve your effectiveness in a customer, sales, or preparation context without giving up your own judgment.",
    probes: [
      "What specific task were you trying to improve, and why did you choose AI for that job?",
      "What did the AI do well, and where did you still need to apply your own judgement?",
      "How did you validate, edit, or challenge the output before using it with others?",
      "What trust, credibility, or accuracy risks did you notice, and how did you manage them?",
      "What changed in the quality, speed, or outcome of your work because of it?",
    ],
    goodEvidence: ["specific practical use", "critical thinking", "balanced judgment", "treats AI as leverage rather than a crutch", "validates before acting"],
    weakEvidence: ["no real usage", "blind reliance", "generic commentary", "treats AI output as truth without verification", "describes efficiency without judgement"],
    evidenceLadder: [
      "What was the situation and what job were you trying to improve?",
      "What was your role in deciding how AI would be used?",
      "What did you personally do with the tool or workflow?",
      "Why did you trust or not trust the output?",
      "Who was affected by the result?",
      "What changed as a result?",
      "What did you learn about using AI responsibly?",
      "What output, decision, or deliverable came from it?",
    ],
    hardToFakeProbes: [
      "How did you validate the AI output before using it?",
      "Where did you deliberately choose not to rely on AI?",
      "What would have gone wrong if you had trusted the output too quickly?",
    ],
    scoreAnchors: {
      1: "No real example. Talks generally about AI without actual use.",
      2: "Weak example. Superficial usage, little validation, and weak evidence of judgement or trust awareness.",
      3: "Solid example. Shows practical usage and some validation, but limited depth on judgement, risk, or stakeholder trust.",
      4: "Strong example. Uses AI purposefully, validates carefully, and balances efficiency with human judgement and credibility.",
      5: "Exceptional example. Demonstrates mature AI judgement, strong validation discipline, and clear trust-preserving use that improves business or customer outcomes.",
    },
  },
  "Technical Credibility & Continuous Learning": {
    definition: "Proactively builds technical capability, stays ahead of relevant trends, and applies new knowledge in ways that improve customer outcomes, business value, and technical credibility.",
    testsFor: ["curiosity", "learning agility", "proactive capability development", "application of new knowledge", "business-linked technical judgement", "continuous evolution"],
    coreQuestion: "Tell me about a time you had to quickly get up to speed on a new technology, domain, or technical issue and then apply that learning in a customer or opportunity context.",
    probes: [
      "What made you realise you needed to learn this, and why did it matter?",
      "How did you go about learning it, and what did you do rather than just reading or listening passively?",
      "How quickly did you apply that learning in a real customer, sales, or technical situation?",
      "What did you do differently because of that learning, and how did it influence the customer, deal, or decision?",
      "How do you stay ahead in your technical area today so you keep evolving rather than reacting late?",
    ],
    goodEvidence: ["proactively identifies learning needs", "shows active learning behaviour", "applies learning quickly", "links learning to customer or business impact", "demonstrates ongoing curiosity and evolution"],
    weakEvidence: ["generic statements about staying current", "describes learning without application", "passive learning only", "overly technical explanation without business relevance", "no clear impact from the learning"],
    evidenceLadder: [
      "What was the situation and what triggered the need to learn?",
      "What was your role in addressing it?",
      "What did you personally do to build the knowledge quickly?",
      "Why did you choose that learning approach?",
      "Who was affected by how you applied that learning?",
      "What changed as a result?",
      "What did you learn about how you develop capability?",
      "How have you reused or extended that learning since then?",
    ],
    hardToFakeProbes: [
      "How did that learning actually change the customer outcome, deal, or technical recommendation?",
      "What did you do differently because of what you learned?",
      "How do you stay ahead in this area today rather than waiting until a customer forces the issue?",
    ],
    scoreAnchors: {
      1: "No evidence. Generic statements about learning or staying current, with no real example.",
      2: "Weak example. Some learning activity is described, but it is mostly passive, vague, or disconnected from real application and impact.",
      3: "Solid example. Clear evidence of learning and some real application, but limited proactivity, speed, or business impact.",
      4: "Strong example. Proactively builds new capability, applies it in a real situation, and improves customer confidence, decision quality, or business outcome.",
      5: "Exceptional example. Anticipates or spots a learning need early, rapidly builds meaningful capability, applies it to create clear customer or business impact, and shows ongoing curiosity and continuous evolution.",
    },
  },
};

export const INTERVIEW_SCORE_SCALE: Record<BehaviouralLevel, string> = {
  1: "No evidence, theoretical or generic only",
  2: "Weak evidence, vague with low ownership or shallow impact",
  3: "Solid evidence, clear example with partial depth",
  4: "Strong evidence, clear ownership, judgement, and meaningful outcome",
  5: "Exceptional evidence, strategic judgement, influence, and measurable impact",
};

export const CROSS_RESPONSE_PATTERNS = [
  "solution-first vs discovery-led",
  "feature-focused vs business-focused",
  "passive vs ownership-driven",
  "reactive vs strategic",
  "technical-only vs balanced",
  "AI-dependent vs AI-augmented",
  "confidence masking lack of depth",
  "polished but shallow",
  "team masking vs personal ownership",
  "strategic language without behaviour",
  "detail without business impact",
] as const;
