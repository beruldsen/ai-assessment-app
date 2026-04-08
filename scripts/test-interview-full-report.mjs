const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";

const capabilities = [
  "Business Value Discovery & Co-Creation",
  "Customer & Internal Influence / Collaboration",
  "Executive Communication, Storytelling & Presence",
  "Strategic Account Thinking",
  "AI Fluency & Human Trust Advantage",
  "Technical Credibility & Continuous Learning",
];

const answersByCapability = {
  "Business Value Discovery & Co-Creation": [
    "In a global manufacturing opportunity, the customer initially asked us to solve a CRM-to-ERP integration issue. During discovery, I realized that was only the symptom. The deeper problem was that inconsistent master data and fragmented workflows were driving poor forecast confidence, slow onboarding, and low adoption in regional teams. I changed my approach from feature mapping to business diagnosis. I interviewed the VP of Sales Operations, regional enablement leads, and the enterprise architect, and I used those conversations to build a picture of where the process was actually breaking down. I reframed the conversation around forecast accuracy, rep ramp time, and data governance rather than just integration mechanics. That shifted the buyer's thinking, and together we agreed measurable success criteria tied to time-to-productivity, reporting consistency, and pipeline accuracy. That reframing helped us expand the opportunity and positioned us as a strategic partner rather than a technical vendor.",
    "The questions I asked were designed to separate surface complaints from business causes. I asked the VP of Sales Operations where forecast confidence was breaking down by region, what manual work managers were doing to compensate, and how often leadership was challenging the numbers. With enablement, I asked what specifically slowed rep ramp time, where onboarding content diverged from live process, and which workflow steps new hires were failing to complete consistently. With the architect, I asked where master data ownership actually sat, how exceptions were handled, and which integrations were masking process gaps rather than solving them. Those questions showed that integration was not the root issue. The real problem was fragmented operating discipline and unclear data ownership, which were hurting adoption, forecast quality, and time to productivity. Once I reframed the discussion around those business outcomes, the customer changed the success criteria and we expanded the deal scope.",
    "I chose those stakeholders because each one could expose a different part of the underlying business problem. The VP of Sales Operations could show where forecast accuracy was breaking down, enablement could show why rep ramp time was slower than leadership expected, and the architect could explain where the integration design was hiding process and ownership issues. If I had only stayed with the technical team, I would have solved for the symptom rather than the business issue. That stakeholder mix gave me the evidence to reframe the conversation and helped the customer define success in a much more commercially meaningful way.",
  ],
  "Customer & Internal Influence / Collaboration": [
    "In a large enterprise security deal, I had to align the account executive, security architects, procurement, legal, and the customer's CIO office. Everyone had different priorities, and progress had stalled because no one owned the cross-functional path forward. I took the lead in mapping stakeholder positions, identifying the real blockers, and creating a working plan that separated technical validation, commercial sequencing, and executive sign-off. I ran a focused alignment session, surfaced the trade-offs openly, and helped both sides agree on a phased approach that reduced risk without killing momentum. I also coached the internal team on which issues needed executive escalation versus technical resolution. The result was that we regained momentum, avoided a late-stage collapse, and closed the deal with stronger internal trust across the account team.",
    "The main pushback came from procurement and one security architect. Procurement wanted to slow everything down until every commercial point was settled, while the architect was worried the phased plan would leave operational exposure. I handled that by separating concerns instead of forcing one conversation to do everything. I worked with the account executive to define what needed commercial escalation, then I met with the architect and customer security lead to clarify the risk controls in the phased approach. That helped each stakeholder see that their issue was being handled seriously without blocking the whole motion. The result was that the CIO office backed the phased plan, procurement stopped holding up the technical workstream, and we moved forward with clearer internal and customer alignment.",
    "What made the difference was active orchestration rather than waiting for alignment to happen by itself. I mapped influence separately from formal authority, because the CIO office could unblock momentum but the architect could still derail the path if his concerns were left unresolved. I chose not to escalate everything immediately because that would have created more friction. Instead, I resolved the technical objection directly and escalated only the commercial decisions that needed senior backing. That changed the pace and quality of the stakeholder conversation and moved the deal forward.",
  ],
  "Executive Communication, Storytelling & Presence": [
    "I once had to explain a fairly complex architecture and migration choice to a regional president and finance sponsor who had very little appetite for technical detail. Instead of walking them through the architecture itself, I structured the discussion around operational risk, implementation speed, and the financial implications of delaying change. I used one simple visual to show the current-state friction and two future-state options, and I framed the recommendation in terms of business trade-offs rather than technical purity. When they challenged the timeline and risk assumptions, I answered directly, stayed calm, and translated technical constraints into business consequences they could evaluate. That helped secure executive sponsorship and gave the delivery team a much clearer mandate going into implementation.",
    "What mattered most to them was reducing disruption and understanding the commercial consequences of delay, not the architecture pattern itself. So I deliberately left out integration-layer detail and low-level migration sequencing. I kept one visual, two options, and a clear recommendation framed around risk, speed, and cost. When I saw the finance sponsor starting to disengage, I shortened the explanation and brought the discussion back to trade-offs and timing. That kept the room with me, and by the end the regional president was summarising the recommendation in business terms, which told me the message had landed.",
    "In the moment when they challenged the timeline, I did not go more technical to defend the plan. I slowed down, acknowledged the concern, and restated the trade-off in business terms, which was speed now versus higher operational risk later. That helped keep the conversation productive because they felt heard rather than corrected. The executive sponsor then shifted from questioning the recommendation to asking what support would be needed to move quickly, which showed the room had moved from doubt to decision-making.",
  ],
  "Strategic Account Thinking": [
    "In one strategic account, we were treating the opportunity as a product evaluation when the customer's broader transformation agenda suggested a much larger strategic play. I noticed that if we only optimized for the immediate deal, we would miss both adoption risk and expansion potential. So I pulled together a more strategic account view, looked at stakeholder change dynamics, and helped the team connect the current opportunity to a larger modernization roadmap. I pushed early on issues like executive sponsorship, downstream operating impact, and how success would be measured beyond go-live. That changed the way we engaged the account, improved stakeholder sequencing, and created a stronger long-term position for expansion rather than just a one-time transaction.",
    "My hypothesis was that the evaluation would stall or underdeliver if we treated it as an isolated product decision rather than part of a broader operating change. I took that view because the customer kept referencing transformation goals, but the account motion was still very feature-and-timeline driven. So I pushed the team to engage more senior stakeholders earlier, test for downstream adoption risk, and define what success would look like beyond initial deployment. I also chose not to prioritise a faster but narrower technical win, because it would have improved short-term momentum while weakening the longer-term account position. That shift helped us earn broader sponsorship and created a stronger path to expansion later.",
    "What changed my view over time was seeing that the real risk was not technical evaluation failure, it was organisational adoption after the initial decision. That is why I broadened the account conversation early instead of waiting for the deal to close. I wanted the team to think about change readiness, sponsor quality, and long-term account value, not just immediate deal velocity. That strategic shift meant we shaped a bigger and more durable account position rather than winning a smaller transaction and dealing with fallout later.",
  ],
  "AI Fluency & Human Trust Advantage": [
    "I use AI regularly, but in a disciplined way. For example, before an executive discovery session I have used AI tools to synthesize account research, summarize discovery notes, and generate hypotheses about likely stakeholder priorities. But I do not treat the output as truth. I validate important claims, remove generic language, and adjust recommendations based on political context and what I know from live conversations. I have also used AI to sharpen messaging and anticipate objections, which improved both my preparation speed and the quality of the conversations. The key for me is that AI improves leverage, but judgment, trust, and accountability still sit with the SE.",
    "I chose AI for that job because it was strong at compressing large amounts of information quickly, but weak at understanding what was politically sensitive or commercially unrealistic. So before I used any output, I cross-checked factual claims, removed anything that sounded generic, and sense-checked it against what I knew from the account team. In one case it suggested a stakeholder priority that looked plausible on paper but was actually outdated, and if I had used it uncritically I would have damaged credibility in the meeting. The real value was speed and synthesis, but the trust came from validating and shaping the output before anyone else saw it.",
    "What made the difference was that I treated AI as a thinking accelerator, not a substitute for judgement. I still owned the recommendation, the stakeholder framing, and the quality bar for what went into the meeting. The customer never saw raw AI output. They saw a better prepared, more focused point of view. That improved both efficiency and trust because the output was filtered through real account knowledge before it reached anyone externally.",
  ],
  "Technical Credibility & Continuous Learning": [
    "I had to get up to speed quickly on a new identity and security architecture pattern when a regulated customer raised concerns that our usual integration approach would not meet their control model. I realised I needed to learn it fast because if I kept relying on the older pattern, we would either lose credibility or recommend something the customer could not govern safely. I went beyond reading documentation. I reviewed recent architecture guidance, spoke with an internal specialist, mapped the control implications against the customer environment, and tested where the failure points would likely emerge. I then used that learning in the live opportunity to reshape the recommendation and explain why a different architecture would reduce governance risk while still meeting the operational need.",
    "What triggered the learning need was seeing that the customer’s concern was not just about product fit, it was about whether the design would stand up in a regulated environment. I chose a hands-on learning approach because I needed applied judgement quickly, not just conceptual knowledge. So I combined expert input, architecture review, and direct mapping to the customer’s operating model. I applied it within the same sales cycle, changed how I framed the recommendation, and helped both the technical and business stakeholders understand why the revised design was safer and more sustainable. That increased trust in our guidance and gave us a reusable pattern for future regulated opportunities.",
    "Since then, I have stayed ahead in that area by actively reviewing how identity, control, and governance requirements are changing rather than waiting for the next customer issue to force the learning. I capture patterns from live deals, compare them with updated technical guidance, and test whether our usual positioning still holds up. That means I am not just reacting to new technical demands. I am evolving my capability in a way that improves future customer conversations, strengthens recommendations, and reduces the risk of giving technically correct but contextually weak advice.",
  ],
};

async function post(path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { ok: res.ok, status: res.status, json };
}

async function get(path) {
  const res = await fetch(`${baseUrl}${path}`, { cache: "no-store" });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { ok: res.ok, status: res.status, json };
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForScores(interviewId, maxWaitMs = 45000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < maxWaitMs) {
    const snapshot = await get(`/api/interviews/${interviewId}`);
    const scores = snapshot.json?.scores ?? [];
    if (scores.length) return snapshot;
    await sleep(2500);
  }
  return get(`/api/interviews/${interviewId}`);
}

async function main() {
  console.log(`Testing full interview report flow against ${baseUrl}`);

  const started = await post("/api/interviews/start", { capabilities });
  if (!started.ok) {
    console.error("Start failed", started.status, started.json);
    process.exit(1);
  }

  const interviewId = started.json.interviewId;
  console.log("Interview started:", interviewId);

  const answerIndexByCapability = Object.fromEntries(capabilities.map((c) => [c, 0]));
  let currentCapability = started.json.interview.current_capability;
  let safety = 0;

  while (currentCapability && safety < 40) {
    safety += 1;
    const answers = answersByCapability[currentCapability] || [];
    const idx = answerIndexByCapability[currentCapability] ?? 0;
    const answer = answers[Math.min(idx, answers.length - 1)];

    if (!answer) {
      console.error("No scripted answer for capability", currentCapability);
      process.exit(1);
    }

    const step = await post(`/api/interviews/${interviewId}/message`, {
      content: answer,
      inputMode: "text",
      outputMode: "tts",
    });
    if (!step.ok) {
      console.error("Message failed", step.status, step.json);
      process.exit(1);
    }

    console.log(`[${currentCapability}] Assistant reply:`, step.json.assistant?.slice(0, 180));

    if (step.json.capability === currentCapability) {
      answerIndexByCapability[currentCapability] = idx + 1;
    }

    currentCapability = step.json.capability;

    const snapshot = await get(`/api/interviews/${interviewId}`);
    const interview = snapshot.json?.interview;
    if (interview?.status === "completed" && interview?.current_capability === capabilities[capabilities.length - 1]) {
      break;
    }
  }

  const completed = await post(`/api/interviews/${interviewId}/complete`, {});
  if (!completed.ok) {
    console.error("Complete failed", completed.status, completed.json);
    process.exit(1);
  }
  console.log("Interview completed, job:", completed.json.jobId);

  const finalSnapshot = await waitForScores(interviewId);
  const reportReady = Boolean(finalSnapshot.json?.report && (finalSnapshot.json?.scores ?? []).length);
  console.log(JSON.stringify({ interviewId, reportReady, scoreCount: finalSnapshot.json?.scores?.length ?? 0 }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
