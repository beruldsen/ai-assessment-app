import { z } from "zod";
import { openai } from "../openai";
import { supabase } from "../supabase";
import { computeScores } from "../scoring/computeScores";

const EvidenceSchema = z.object({
  domain: z.string().min(1),
  indicator: z.string().min(1),
  strength: z.enum(["strong", "moderate", "weak"]),
  confidence: z.number().min(0).max(1),
  excerpts: z
    .array(
      z.object({
        text: z.string(),
        msg_index: z.number().int().nonnegative(),
      })
    )
    .default([]),
  notes: z.string().optional().default(""),
});

const EvidenceListSchema = z.array(EvidenceSchema);

function normalizeEvidencePayload(input: unknown) {
  const toArray = (v: unknown): unknown[] => {
    if (Array.isArray(v)) return v;
    if (v && typeof v === "object") {
      const obj = v as Record<string, unknown>;
      const candidates = [obj.evidence, obj.items, obj.data, obj.results];
      for (const c of candidates) {
        if (Array.isArray(c)) return c;
      }
    }
    return [];
  };

  const rawItems = toArray(input);

  return rawItems.map((item) => {
    const o = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;

    const domain = String(o.domain ?? o.category ?? o.competency ?? "General").trim();
    const indicator = String(o.indicator ?? o.behavior ?? o.signal ?? "Observed behavior").trim();
    const strengthRaw = String(o.strength ?? o.rating ?? o.level ?? "moderate").toLowerCase();
    const strength = strengthRaw === "strong" || strengthRaw === "weak" ? strengthRaw : "moderate";

    let confidence = Number(o.confidence ?? o.score_confidence ?? 0.65);
    if (!Number.isFinite(confidence)) confidence = 0.65;
    confidence = Math.max(0, Math.min(1, confidence));

    const excerptsRaw = Array.isArray(o.excerpts) ? o.excerpts : [];
    const excerpts = excerptsRaw
      .map((x) => {
        const ex = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
        return {
          text: String(ex.text ?? "").trim(),
          msg_index: Number.isFinite(Number(ex.msg_index)) ? Number(ex.msg_index) : 0,
        };
      })
      .filter((x) => x.text.length > 0);

    const notes = String(o.notes ?? o.rationale ?? "").trim();

    return { domain, indicator, strength, confidence, excerpts, notes };
  });
}

type JobPayload = {
  attemptId: string;
  orgId?: string | null;
};

function calibrateScores(
  scores: Array<{ domain: string; score: number; maturity: string; evidence_count: number }>,
  candidateTurns: Array<{ content: string }>
) {
  const turnCount = candidateTurns.length;
  const avgLen =
    turnCount > 0
      ? candidateTurns.reduce((sum, t) => sum + (t.content?.trim().length ?? 0), 0) / turnCount
      : 0;

  return scores.map((s) => {
    let capped = s.score;

    if (turnCount <= 1) capped = Math.min(capped, 2.0);
    else if (turnCount === 2) capped = Math.min(capped, 3.0);

    if (avgLen < 50) capped = Math.min(capped, 2.5);
    else if (avgLen < 90) capped = Math.min(capped, 3.5);

    if (s.evidence_count < 2) capped = Math.min(capped, 3.5);

    const maturity = capped >= 4 ? "future_ready" : capped >= 2.5 ? "advanced" : "foundation";

    return {
      ...s,
      score: Number(capped.toFixed(2)),
      maturity,
    };
  });
}

export async function scoreSimulation(payload: JobPayload) {
  const { attemptId, orgId = null } = payload;

  const [attemptRes, scenarioRes, messagesRes] = await Promise.all([
    supabase.from("simulation_attempts").select("id,scenario_id").eq("id", attemptId).single(),
    supabase
      .from("simulation_attempts")
      .select("simulation_scenarios(name,role,context)")
      .eq("id", attemptId)
      .single(),
    supabase
      .from("simulation_messages")
      .select("sender,content")
      .eq("attempt_id", attemptId)
      .order("created_at", { ascending: true }),
  ]);

  if (attemptRes.error || !attemptRes.data) throw new Error(attemptRes.error?.message ?? "Attempt not found");
  if (scenarioRes.error || !scenarioRes.data) throw new Error(scenarioRes.error?.message ?? "Scenario not found");
  if (messagesRes.error || !messagesRes.data) throw new Error(messagesRes.error.message);

  const scenario = (scenarioRes.data as { simulation_scenarios: { name: string; role: string; context: unknown } | null }).simulation_scenarios;
  const messages = messagesRes.data;

  const candidateTurns = messages
    .map((m, i) => ({ msg_index: i, sender: m.sender, content: m.content }))
    .filter((m) => m.sender === "user");

  const prompt = [
    "You are an assessment extractor.",
    "Assess ONLY the candidate (sender='user'). Do NOT score the buyer/assistant persona.",
    "Buyer/assistant messages are context only.",
    "Return strictly JSON object with key `evidence` whose value is an array.",
    "No markdown, no prose.",
    "Each evidence item must include: domain, indicator, strength (strong|moderate|weak), confidence (0..1), excerpts[], notes.",
    "Be conservative: for brief or generic candidate answers, use weak/moderate evidence, not strong.",
    `Scenario: ${JSON.stringify(scenario)}`,
    `Candidate turns only (score these): ${JSON.stringify(candidateTurns)}`,
    `Full transcript (context): ${JSON.stringify(messages.map((m, i) => ({ msg_index: i, ...m })))}`,
  ].join("\n");

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "Return JSON object: { \"evidence\": Evidence[] } only." },
      { role: "user", content: prompt },
    ],
  });

  const raw = completion.choices?.[0]?.message?.content ?? "{\"evidence\":[]}";

  let parsed: unknown = { evidence: [] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { evidence: [] };
  }

  const normalized = normalizeEvidencePayload(parsed);
  const evidenceList = EvidenceListSchema.parse(normalized);

  await supabase.from("evidence").delete().eq("attempt_id", attemptId);
  await supabase.from("scores").delete().eq("attempt_id", attemptId);

  if (evidenceList.length > 0) {
    const ins = await supabase.from("evidence").insert(
      evidenceList.map((e) => ({
        org_id: orgId,
        attempt_id: attemptId,
        domain: e.domain,
        indicator: e.indicator,
        strength: e.strength,
        confidence: e.confidence,
        excerpts: e.excerpts,
        notes: e.notes,
      }))
    );
    if (ins.error) throw new Error(ins.error.message);
  }

  const rawScores = computeScores(evidenceList.map((e) => ({ domain: e.domain, strength: e.strength })));
  const scores = calibrateScores(rawScores, candidateTurns);

  if (scores.length > 0) {
    const scoreIns = await supabase.from("scores").insert(
      scores.map((s) => ({
        org_id: orgId,
        attempt_id: attemptId,
        domain: s.domain,
        score: s.score,
        maturity: s.maturity,
        evidence_count: s.evidence_count,
      }))
    );
    if (scoreIns.error) throw new Error(scoreIns.error.message);
  }

  return { evidenceCount: evidenceList.length, domainsScored: scores.length };
}
