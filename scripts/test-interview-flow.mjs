const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";

const capabilities = [
  "Business Value Discovery & Co-Creation",
  "Customer & Internal Influence / Collaboration",
  "Executive Communication, Storytelling & Presence",
  "Strategic Account Thinking",
  "AI Fluency & Human Trust Advantage",
  "Technical Credibility & Continuous Learning",
];

const answers = [
  "In a global manufacturing opportunity, the customer initially asked us to solve a CRM-to-ERP integration issue. During discovery, I realized that was only the symptom. The deeper problem was that inconsistent master data and fragmented workflows were driving poor forecast confidence, slow onboarding, and low adoption in regional teams. I changed my approach from feature mapping to business diagnosis. I interviewed the VP of Sales Operations, regional enablement leads, and the enterprise architect, and I used those conversations to build a picture of where the process was actually breaking down. I reframed the conversation around forecast accuracy, rep ramp time, and data governance rather than just integration mechanics. That shifted the buyer's thinking, and together we agreed measurable success criteria tied to time-to-productivity, reporting consistency, and pipeline accuracy. That reframing helped us expand the opportunity and positioned us as a strategic partner rather than a technical vendor.",
  "The questions I asked were designed to separate surface complaints from business causes. I asked the VP of Sales Operations where forecast confidence was breaking down by region, what manual work managers were doing to compensate, and how often leadership was challenging the numbers. With enablement, I asked what specifically slowed rep ramp time, where onboarding content diverged from live process, and which workflow steps new hires were failing to complete consistently. With the architect, I asked where master data ownership actually sat, how exceptions were handled, and which integrations were masking process gaps rather than solving them. Those questions showed that integration was not the root issue. The real problem was fragmented operating discipline and unclear data ownership, which were hurting adoption, forecast quality, and time to productivity. Once I reframed the discussion around those business outcomes, the customer changed the success criteria and we expanded the deal scope.",
  "In a large enterprise security deal, I had to align the account executive, security architects, procurement, legal, and the customer's CIO office. Everyone had different priorities, and progress had stalled because no one owned the cross-functional path forward. I took the lead in mapping stakeholder positions, identifying the real blockers, and creating a working plan that separated technical validation, commercial sequencing, and executive sign-off. I ran a focused alignment session, surfaced the trade-offs openly, and helped both sides agree on a phased approach that reduced risk without killing momentum. I also coached the internal team on which issues needed executive escalation versus technical resolution. The result was that we regained momentum, avoided a late-stage collapse, and closed the deal with stronger internal trust across the account team.",
  "I once had to explain a fairly complex architecture and migration choice to a regional president and finance sponsor who had very little appetite for technical detail. Instead of walking them through the architecture itself, I structured the discussion around operational risk, implementation speed, and the financial implications of delaying change. I used one simple visual to show the current-state friction and two future-state options, and I framed the recommendation in terms of business trade-offs rather than technical purity. When they challenged the timeline and risk assumptions, I answered directly, stayed calm, and translated technical constraints into business consequences they could evaluate. That helped secure executive sponsorship and gave the delivery team a much clearer mandate going into implementation.",
  "In one strategic account, we were treating the opportunity as a product evaluation when the customer's broader transformation agenda suggested a much larger strategic play. I noticed that if we only optimized for the immediate deal, we would miss both adoption risk and expansion potential. So I pulled together a more strategic account view, looked at stakeholder change dynamics, and helped the team connect the current opportunity to a larger modernization roadmap. I pushed early on issues like executive sponsorship, downstream operating impact, and how success would be measured beyond go-live. That changed the way we engaged the account, improved stakeholder sequencing, and created a stronger long-term position for expansion rather than just a one-time transaction.",
  "I use AI regularly, but in a disciplined way. For example, before an executive discovery session I have used AI tools to synthesize account research, summarize discovery notes, and generate hypotheses about likely stakeholder priorities. But I do not treat the output as truth. I validate important claims, remove generic language, and adjust recommendations based on political context and what I know from live conversations. I have also used AI to sharpen messaging and anticipate objections, which improved both my preparation speed and the quality of the conversations. The key for me is that AI improves leverage, but judgment, trust, and accountability still sit with the SE.",
  "In a technically difficult presales cycle involving identity, data synchronization, and security constraints, the customer team initially thought the problem was product fit. As I dug into the architecture, I realized the real issue was an incorrect assumption about where transformation logic and access controls should sit in the workflow. I worked through the architecture with the customer solution architect, clarified the trade-offs, and translated the implications into a clear decision framework for both technical and business stakeholders. Because I could explain both the engineering detail and the operational impact, the customer trusted the recommendation and changed course. I also came away with a better understanding of how similar patterns show up in regulated enterprise environments, which I’ve used in later opportunities.",
];

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

async function waitForScores(interviewId, maxWaitMs = 30000) {
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
  console.log(`Testing interview flow against ${baseUrl}`);

  const started = await post("/api/interviews/start", { capabilities });
  if (!started.ok) {
    console.error("Start failed", started.status, started.json);
    process.exit(1);
  }

  const interviewId = started.json.interviewId;
  console.log("Interview started:", interviewId);

  for (const answer of answers) {
    const step = await post(`/api/interviews/${interviewId}/message`, {
      content: answer,
      inputMode: "text",
      outputMode: "tts",
    });
    if (!step.ok) {
      console.error("Message failed", step.status, step.json);
      process.exit(1);
    }
    console.log("Assistant reply:", step.json.assistant?.slice(0, 180));
  }

  const completed = await post(`/api/interviews/${interviewId}/complete`, {});
  if (!completed.ok) {
    console.error("Complete failed", completed.status, completed.json);
    process.exit(1);
  }
  console.log("Interview completed, job:", completed.json.jobId);

  const finalSnapshot = await waitForScores(interviewId);
  console.log(JSON.stringify({ interviewId, snapshot: finalSnapshot.json }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
