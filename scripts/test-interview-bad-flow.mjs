const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";

const capabilities = [
  "Business Value Discovery & Co-Creation",
  "Customer & Internal Influence / Collaboration",
  "Executive Communication, Storytelling & Presence",
  "Strategic Account Thinking",
  "AI Fluency & Human Trust Advantage",
  "Technical Credibility & Continuous Learning",
];

const badAnswers = [
  "I usually try to understand the customer and help where I can.",
  "It depends on the situation but I ask some questions and then recommend something.",
  "I work with different people and try to keep everyone aligned.",
  "I explain things simply when needed.",
  "I think strategically about accounts.",
  "I use AI sometimes to save time.",
  "I keep learning technical things as needed.",
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

async function main() {
  console.log(`Testing bad-answer interview flow against ${baseUrl}`);

  const started = await post("/api/interviews/start", { capabilities });
  if (!started.ok) {
    console.error("Start failed", started.status, started.json);
    process.exit(1);
  }

  const interviewId = started.json.interviewId;
  console.log("Interview started:", interviewId);

  for (const answer of badAnswers) {
    const step = await post(`/api/interviews/${interviewId}/message`, {
      content: answer,
      inputMode: "text",
      outputMode: "tts",
    });
    if (!step.ok) {
      console.error("Message failed", step.status, step.json);
      process.exit(1);
    }
    console.log("Capability:", step.json.capability, "| fitAccepted:", step.json.fitAccepted, "| reply:", step.json.assistant?.slice(0, 180));
  }

  const snapshot = await get(`/api/interviews/${interviewId}`);
  console.log(JSON.stringify({ interviewId, snapshot: snapshot.json }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
