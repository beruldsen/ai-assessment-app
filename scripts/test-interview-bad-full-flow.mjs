const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";

const capabilities = [
  "Business Value Discovery & Co-Creation",
  "Customer & Internal Influence / Collaboration",
  "Executive Communication, Storytelling & Presence",
  "Strategic Account Thinking",
  "AI Fluency & Human Trust Advantage",
  "Technical Credibility & Continuous Learning",
];

const weakAnswersByCapability = {
  "Business Value Discovery & Co-Creation": [
    "I try to understand the customer.",
    "I ask questions and try to help.",
    "I work with people and look at the problem.",
    "I explain the value when needed.",
  ],
  "Customer & Internal Influence / Collaboration": [
    "I usually work with different stakeholders.",
    "I try to keep people aligned.",
    "I help move things forward when there are blockers.",
    "I communicate with the team to keep momentum.",
  ],
  "Executive Communication, Storytelling & Presence": [
    "I explain technical things simply.",
    "I adapt to the audience.",
    "I answer questions when people push back.",
    "I try to be clear and confident.",
  ],
  "Strategic Account Thinking": [
    "I think about the bigger picture.",
    "I consider long-term account potential.",
    "I look at risks and next steps.",
    "I try to be proactive.",
  ],
  "AI Fluency & Human Trust Advantage": [
    "I use AI sometimes in my work.",
    "It helps me save time.",
    "I still use my own judgment.",
    "I review the output before using it.",
  ],
  "Technical Credibility & Continuous Learning": [
    "I keep learning technical things.",
    "I try to understand the architecture.",
    "I help explain technical issues.",
    "I learn from experience.",
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

async function main() {
  console.log(`Testing full weak-answer interview flow against ${baseUrl}`);

  const started = await post("/api/interviews/start", { capabilities });
  if (!started.ok) {
    console.error("Start failed", started.status, started.json);
    process.exit(1);
  }

  const interviewId = started.json.interviewId;
  console.log("Interview started:", interviewId);

  let currentCapability = capabilities[0];

  for (const capability of capabilities) {
    const answers = weakAnswersByCapability[capability];
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
      currentCapability = step.json.capability;
      console.log("Asked under:", capability, "| now at:", currentCapability, "| reply:", step.json.assistant?.slice(0, 160));
      if (currentCapability !== capability) {
        break;
      }
    }
  }

  const snapshot = await get(`/api/interviews/${interviewId}`);
  console.log(JSON.stringify({ interviewId, currentCapability, snapshot: snapshot.json }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
