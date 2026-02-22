import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { openai } from "@/lib/openai";

type Ctx = { params: Promise<{ attemptId: string }> };

function getStage(userTurnCount: number) {
  if (userTurnCount <= 1) return "discovery";
  if (userTurnCount <= 3) return "value_framing";
  if (userTurnCount <= 5) return "objection_handling";
  return "close_next_step";
}

function stageInstruction(stage: string) {
  switch (stage) {
    case "discovery":
      return "Focus on discovery. Ask for context, priorities, and constraints. Do not accept generic claims.";
    case "value_framing":
      return "Pressure-test value framing. Ask for measurable business impact, timeline, and success metrics.";
    case "objection_handling":
      return "Raise realistic executive objections (risk, adoption, cost, proof) and test clarity and confidence.";
    default:
      return "Push for a concrete next step: decision process, stakeholders, timeline, and proof plan.";
  }
}

export async function POST(req: Request, ctx: Ctx) {
  try {
    const { attemptId } = await ctx.params;
    const { content } = (await req.json()) as { content?: string };

    if (!attemptId) {
      return NextResponse.json({ error: "attemptId is required" }, { status: 400 });
    }
    if (!content?.trim()) {
      return NextResponse.json({ error: "content is required" }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not set" }, { status: 500 });
    }

    const { error: userErr } = await supabaseServer
      .from("simulation_messages")
      .insert({ attempt_id: attemptId, sender: "user", content: content.trim() });

    if (userErr) {
      return NextResponse.json({ error: userErr.message }, { status: 400 });
    }

    const { data: attempt, error: attemptErr } = await supabaseServer
      .from("simulation_attempts")
      .select("scenario_id")
      .eq("id", attemptId)
      .single();

    if (attemptErr || !attempt?.scenario_id) {
      return NextResponse.json({ error: attemptErr?.message ?? "Missing scenario" }, { status: 400 });
    }

    const { data: scenario, error: scenarioErr } = await supabaseServer
      .from("simulation_scenarios")
      .select("name, role, context")
      .eq("id", attempt.scenario_id)
      .single();

    if (scenarioErr || !scenario) {
      return NextResponse.json({ error: scenarioErr?.message ?? "Scenario not found" }, { status: 400 });
    }

    const { data: history, error: histErr } = await supabaseServer
      .from("simulation_messages")
      .select("sender, content")
      .eq("attempt_id", attemptId)
      .order("created_at", { ascending: true })
      .limit(30);

    if (histErr) {
      return NextResponse.json({ error: histErr.message }, { status: 400 });
    }

    const userTurnCount = (history ?? []).filter((m) => m.sender === "user").length;
    const stage = getStage(userTurnCount);

    const system = [
      `You are role-playing as the customer's ${scenario.role} in a presales meeting.`,
      `Scenario: ${scenario.name}.`,
      `Context (JSON): ${JSON.stringify(scenario.context ?? {})}.`,
      `Current stage: ${stage}.`,
      `Stage objective: ${stageInstruction(stage)}.`,
      "Rules:",
      `- Stay in character as the ${scenario.role}.`,
      "- Be realistic, slightly challenging, concise, and business-oriented.",
      "- Speak as a buyer/executive, not as a seller, coach, or interviewer.",
      "- Do not advise the candidate on what they should ask or how to sell.",
      "- Keep responses to max 3-4 sentences unless candidate asks for detail.",
      "- Usually respond with a business reaction plus at most one clarifying/challenging question.",
      "- Do not mention you are an AI or that this is a simulation.",
    ].join("\n");

    const messages = [
      { role: "system" as const, content: system },
      ...((history ?? []).map((m) => ({
        role: (m.sender === "user" ? "user" : "assistant") as const,
        content: m.content,
      })) ?? []),
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages,
      temperature: 0.6,
      max_tokens: 220,
    });

    const assistantContent =
      completion.choices?.[0]?.message?.content?.trim() ||
      "Can you clarify the business impact and how you will measure it?";

    const { error: asstErr } = await supabaseServer
      .from("simulation_messages")
      .insert({ attempt_id: attemptId, sender: "assistant", content: assistantContent });

    if (asstErr) {
      return NextResponse.json({ error: asstErr.message }, { status: 400 });
    }

    return NextResponse.json({ assistant: assistantContent, stage });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
