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

type JobPayload = {
  attemptId: string;
  orgId?: string | null;
};

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

  const prompt = [
    "You are an assessment extractor.",
    "Given a simulation transcript, output ONLY JSON array of evidence objects.",
    "No markdown, no prose.",
    "Allowed strengths: strong, moderate, weak.",
    `Scenario: ${JSON.stringify(scenario)}`,
    `Transcript: ${JSON.stringify(messages.map((m, i) => ({ msg_index: i, ...m })))}`,
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
  const parsed = JSON.parse(raw);
  const evidenceList = EvidenceListSchema.parse(parsed.evidence ?? []);

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

  const scores = computeScores(evidenceList.map((e) => ({ domain: e.domain, strength: e.strength })));

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
