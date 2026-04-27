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
    "In one mid-market SaaS deal, the customer initially asked for a product demo focused on pipeline dashboards. I asked a few follow-up questions and realised their real issue was inconsistent stage definitions across regional teams, which meant leadership did not trust the forecast. I shifted the conversation from demoing features to understanding where forecast discipline was breaking down and what that meant for planning. That helped us frame the value around forecast reliability rather than reporting cosmetics.",
    "I involved the sales operations lead and the regional manager because they could explain where the data quality and process gaps were actually hurting decisions. I chose that route because staying only with the admin team would have kept the discussion too technical. The outcome was that we redefined success around forecast consistency and manager inspection rather than a faster dashboard build, although I did not put a hard numeric impact on it."
  ],
  "Customer & Internal Influence / Collaboration": [
    "In a security renewal with expansion potential, legal, procurement, the account executive, and the customer security lead were all pulling in different directions. I took ownership of mapping the blockers and set up a short working session to separate contract issues from technical assurance questions. That created a clearer path forward and stopped the deal from drifting.",
    "The hardest part was that procurement wanted everything resolved before the technical team moved, while the security lead needed reassurance first. I handled that by keeping two parallel tracks moving and by working closely with the AE on what needed escalation versus what I could solve directly. We did get the renewal over the line and preserved the expansion conversation, even though it took longer than I wanted."
  ],
  "Executive Communication, Storytelling & Presence": [
    "I had to brief a country manager and finance lead on an integration approach for a rollout that was behind schedule. I avoided a deep architecture walk-through and instead explained the trade-off between implementation speed, risk, and support overhead. I used one simple before-and-after visual so they could see the operational impact quickly.",
    "When the finance lead started pushing on timeline assumptions, I stayed with the business consequences rather than defending the design in technical language. That kept the discussion constructive and helped us get approval to move ahead, although I think I could have made the narrative tighter and more memorable."
  ],
  "Strategic Account Thinking": [
    "In one account, I could see the team was treating the opportunity as a standalone product evaluation when the customer was actually in the middle of a broader operating model change. I flagged that the bigger risk was adoption after go-live, not just winning the technical validation, and I pushed for earlier executive alignment. That changed how we sequenced the account conversations.",
    "My hypothesis was that if we optimised only for short-term deal speed, we would create a weaker position for long-term growth. I based that on the customer talking about transformation goals while our team was still focused on a narrow workstream. We improved sponsorship and got a better expansion path, but I would like to be more explicit in future about measurable account outcomes."
  ],
  "AI Fluency & Human Trust Advantage": [
    "I use AI mostly to speed up preparation. For example, before discovery calls I use it to summarise research and draft hypotheses about likely stakeholder concerns. I do not use the output directly with customers because it is often too generic unless I reshape it.",
    "The useful part is speed, but I still validate anything important against account context and live notes. I think my use of AI is sensible and disciplined, though I have not yet done much with it in live customer interactions or collaborative workshops."
  ],
  "Technical Credibility & Continuous Learning": [
    "A regulated customer raised concerns about whether our standard architecture would meet their control model, so I had to get up to speed quickly on a newer identity pattern. I reviewed the latest guidance, spoke to an internal specialist, and mapped the implications against the customer environment. That let me change the recommendation with more confidence.",
    "What mattered was not just learning the pattern, but applying it in a way that increased trust with both the architect and the business sponsor. Since then I have kept tracking changes in that area, although I have not yet formalised the learning into a repeatable team asset."
  ]
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
  console.log(`Testing mixed-strength full interview report flow against ${baseUrl}`);

  const started = await post("/api/interviews/start", { capabilities });
  if (!started.ok) {
    console.error("Start failed", started.status, started.json);
    process.exit(1);
  }

  const interviewId = started.json.interviewId;
  console.log("Interview started:", interviewId);

  for (const capability of capabilities) {
    const answers = answersByCapability[capability];
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
      console.log(`[${capability}] now at: ${step.json.capability} | reply: ${step.json.assistant?.slice(0, 160)}`);
    }
  }

  const completed = await post(`/api/interviews/${interviewId}/complete`, {});
  if (!completed.ok) {
    console.error("Complete failed", completed.status, completed.json);
    process.exit(1);
  }
  console.log("Interview completed, job:", completed.json.jobId);

  const finalSnapshot = await waitForScores(interviewId);
  const scores = finalSnapshot.json?.scores ?? [];
  console.log(JSON.stringify({
    interviewId,
    reportReady: Boolean(finalSnapshot.json?.report && scores.length),
    scoreCount: scores.length,
    scores: scores.map((s) => ({ capability: s.capability, score: s.score })),
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
