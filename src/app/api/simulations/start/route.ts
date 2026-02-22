import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

function getCtx(context: unknown) {
  if (!context || typeof context !== "object") return {} as Record<string, unknown>;
  return context as Record<string, unknown>;
}

function buildNaturalOpener(role: string, scenarioName: string, context: unknown) {
  const c = getCtx(context);
  const company = String(c.company ?? c.customer ?? "the business");
  const challenge = c.challenge ? String(c.challenge) : "we need to improve business performance quickly";
  const goal = c.goal ? String(c.goal) : "we need a clear path to measurable value";
  const stakes = c.stakes ? String(c.stakes) : "I need confidence before recommending this internally";
  const stage = c.deal_stage ? String(c.deal_stage) : "";
  const sellerRole = c.seller_role ? String(c.seller_role) : "the presales lead";

  return [
    `Hi, thanks for joining. I'm the ${role} at ${company}.`,
    `Quick context: this is the ${scenarioName}${stage ? ` (${stage} stage)` : ""}.`,
    `We're facing ${challenge}.`,
    `My objective is ${goal}, and ${stakes}.`,
    `I understand your role here is ${sellerRole}.`,
    "Give me your initial point of view in 30 seconds, then I will challenge your assumptions.",
  ].join(" ");
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

    const opener = buildNaturalOpener(
      scenario?.role ?? "stakeholder",
      scenario?.name ?? "Assessment conversation",
      scenario?.context
    );

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
