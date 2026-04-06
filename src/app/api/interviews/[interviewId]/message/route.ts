import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { openai } from "@/lib/openai";
import { INTERVIEW_PROMPTS, capabilityIntro, type Capability } from "@/lib/capabilityFramework";

type Ctx = { params: Promise<{ interviewId: string }> };

type InterviewRecord = {
  id: string;
  status: "running" | "completed" | "failed";
  selected_capabilities: Capability[] | null;
  current_capability: Capability | null;
};

function buildFollowUp(answer: string, capability: Capability) {
  const lc = answer.toLowerCase();
  if (!lc.includes("result") && !lc.includes("outcome")) return "What was the measurable result?";
  if (!lc.includes("i ")) return "What exactly did you do personally?";
  if (lc.length < 140) return `Can you give me a more specific example related to ${capability}?`;
  return "What would you do differently if you handled that again?";
}

export async function POST(req: Request, ctx: Ctx) {
  try {
    const { interviewId } = await ctx.params;
    const body = await req.json();
    const content = String(body?.content ?? "").trim();

    if (!interviewId) return NextResponse.json({ error: "interviewId is required" }, { status: 400 });
    if (!content) return NextResponse.json({ error: "content is required" }, { status: 400 });

    const { data: interview, error: interviewErr } = await supabaseServer
      .from("interviews")
      .select("id,status,selected_capabilities,current_capability")
      .eq("id", interviewId)
      .single<InterviewRecord>();

    if (interviewErr || !interview) {
      return NextResponse.json({ error: interviewErr?.message ?? "Interview not found" }, { status: 404 });
    }

    const capability = interview.current_capability ?? (interview.selected_capabilities?.[0] as Capability | undefined);
    if (!capability) {
      return NextResponse.json({ error: "Interview has no capability context" }, { status: 400 });
    }

    const { error: insertUserErr } = await supabaseServer.from("interview_messages").insert({
      interview_id: interviewId,
      capability,
      role: "user",
      transcript_text: content,
      metadata: { inputMode: body?.inputMode ?? "text" },
    });

    if (insertUserErr) {
      return NextResponse.json({ error: insertUserErr.message }, { status: 500 });
    }

    const { data: history, error: historyErr } = await supabaseServer
      .from("interview_messages")
      .select("role, transcript_text, capability")
      .eq("interview_id", interviewId)
      .order("created_at", { ascending: true });

    if (historyErr) {
      return NextResponse.json({ error: historyErr.message }, { status: 500 });
    }

    let assistant = buildFollowUp(content, capability);

    if (process.env.OPENAI_API_KEY) {
      const system = [
        "You are a senior Sales Engineering leader conducting a behavioural interview.",
        `Current capability: ${capability}.`,
        `Use this intro logic: ${capabilityIntro(capability)}`,
        `Use these starter prompts as context: ${JSON.stringify(INTERVIEW_PROMPTS[capability])}`,
        "Interview rules:",
        "- Ask for real past examples, not hypotheticals.",
        "- Probe using STAR: situation, task, action, result.",
        "- Push for specificity, ownership, and measurable outcomes.",
        "- Be concise, credible, professional, and slightly challenging.",
        "- Ask exactly one best next probing question.",
      ].join("\n");

      const completion = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        temperature: 0.4,
        max_tokens: 180,
        messages: [
          { role: "system", content: system },
          ...(history ?? []).map((m) => ({
            role: m.role === "user" ? ("user" as const) : ("assistant" as const),
            content: m.transcript_text,
          })),
        ],
      });

      assistant = completion.choices?.[0]?.message?.content?.trim() || assistant;
    }

    const { error: insertAssistantErr } = await supabaseServer.from("interview_messages").insert({
      interview_id: interviewId,
      capability,
      role: "assistant",
      transcript_text: assistant,
      metadata: { outputMode: body?.outputMode ?? "voice" },
    });

    if (insertAssistantErr) {
      return NextResponse.json({ error: insertAssistantErr.message }, { status: 500 });
    }

    return NextResponse.json({ assistant, capability });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
