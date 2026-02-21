import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

type Ctx = { params: Promise<{ attemptId: string }> };

type ChatMsg = { sender: "user" | "assistant"; content: string };

async function generateAssistantReply(input: {
  role: string;
  context: Record<string, unknown> | null;
  history: ChatMsg[];
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const system = [
    `You are role-playing as a ${input.role} in a B2B sales discovery simulation.`,
    "Stay in character and be realistic, concise, and challenging.",
    "Ask one focused follow-up question when appropriate.",
    "Do not provide coaching or break character.",
    `Scenario context: ${JSON.stringify(input.context ?? {})}`,
  ].join(" ");

  const messages = [
    { role: "system", content: system },
    ...input.history.map((m) => ({
      role: m.sender === "assistant" ? "assistant" : "user",
      content: m.content,
    })),
  ];

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 220,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI error: ${text}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("Empty assistant response from OpenAI");
  }

  return content;
}

export async function POST(req: Request, ctx: Ctx) {
  try {
    const { attemptId } = await ctx.params;
    const body = await req.json();
    const content = body?.content as string | undefined;

    if (!attemptId) {
      return NextResponse.json({ error: "attemptId is required" }, { status: 400 });
    }
    if (!content?.trim()) {
      return NextResponse.json({ error: "content is required" }, { status: 400 });
    }

    const userInsert = await supabaseServer.from("simulation_messages").insert({
      attempt_id: attemptId,
      sender: "user",
      content: content.trim(),
    });
    if (userInsert.error) {
      return NextResponse.json({ error: userInsert.error.message }, { status: 500 });
    }

    const attemptRes = await supabaseServer
      .from("simulation_attempts")
      .select("scenario_id")
      .eq("id", attemptId)
      .single();

    if (attemptRes.error || !attemptRes.data?.scenario_id) {
      return NextResponse.json(
        { error: attemptRes.error?.message ?? "Scenario not found for attempt" },
        { status: 500 }
      );
    }

    const scenarioRes = await supabaseServer
      .from("simulation_scenarios")
      .select("role, context")
      .eq("id", attemptRes.data.scenario_id)
      .single();

    if (scenarioRes.error || !scenarioRes.data) {
      return NextResponse.json(
        { error: scenarioRes.error?.message ?? "Scenario lookup failed" },
        { status: 500 }
      );
    }

    const historyRes = await supabaseServer
      .from("simulation_messages")
      .select("sender, content, created_at")
      .eq("attempt_id", attemptId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (historyRes.error) {
      return NextResponse.json({ error: historyRes.error.message }, { status: 500 });
    }

    const history = (historyRes.data ?? [])
      .slice()
      .reverse()
      .map((m) => ({
        sender: m.sender as "user" | "assistant",
        content: m.content as string,
      }));

    const assistantText = await generateAssistantReply({
      role: scenarioRes.data.role as string,
      context: (scenarioRes.data.context as Record<string, unknown> | null) ?? null,
      history,
    });

    const assistantInsert = await supabaseServer
      .from("simulation_messages")
      .insert({
        attempt_id: attemptId,
        sender: "assistant",
        content: assistantText,
      })
      .select("id, sender, content, created_at")
      .single();

    if (assistantInsert.error) {
      return NextResponse.json({ error: assistantInsert.error.message }, { status: 500 });
    }

    return NextResponse.json({ assistant: assistantInsert.data });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
