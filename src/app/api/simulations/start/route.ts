import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

function buildScenarioBrief(context: unknown) {
  if (!context || typeof context !== "object") return "";
  const c = context as Record<string, unknown>;
  const parts: string[] = [];
  if (c.company) parts.push(`Company: ${String(c.company)}`);
  if (c.industry) parts.push(`Industry: ${String(c.industry)}`);
  if (c.challenge) parts.push(`Challenge: ${String(c.challenge)}`);
  if (c.goal) parts.push(`Goal: ${String(c.goal)}`);
  if (c.stakes) parts.push(`Stakes: ${String(c.stakes)}`);
  return parts.join(" | ");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const scenarioId = body?.scenarioId as string | undefined;
    const orgId = (body?.orgId as string | null | undefined) ?? null;
    const userId = (body?.userId as string | null | undefined) ?? null;

    if (!scenarioId) {
      return NextResponse.json({ error: "scenarioId is required" }, { status: 400 });
    }

    const { data, error } = await supabaseServer
      .from("simulation_attempts")
      .insert({
        scenario_id: scenarioId,
        scenario_key: scenarioId,
        org_id: orgId,
        user_id: userId,
        status: "running", // DB constraint currently allows pending|running|completed|failed
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: scenario } = await supabaseServer
      .from("simulation_scenarios")
      .select("name,role,context")
      .eq("id", scenarioId)
      .single();

    const scenarioBrief = buildScenarioBrief(scenario?.context);

    const opener = [
      `Hi, I am the ${scenario?.role ?? "stakeholder"} for this scenario.`,
      scenarioBrief ? scenarioBrief : `Context: ${scenario?.name ?? "Assessment conversation"}.`,
      "Please start by asking me 1-2 questions to understand priorities before pitching any solution.",
    ].join(" ");

    const { error: openerErr } = await supabaseServer
      .from("simulation_messages")
      .insert({ attempt_id: data.id, sender: "assistant", content: opener });

    if (openerErr) {
      return NextResponse.json({ error: openerErr.message }, { status: 500 });
    }

    return NextResponse.json({ attemptId: data.id });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
