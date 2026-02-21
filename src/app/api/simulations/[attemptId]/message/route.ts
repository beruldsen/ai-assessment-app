import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

type Ctx = { params: Promise<{ attemptId: string }> };

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

    const placeholder = "Got it — tell me how you’d justify ROI in year one.";

    const assistantInsert = await supabaseServer
      .from("simulation_messages")
      .insert({
        attempt_id: attemptId,
        sender: "assistant",
        content: placeholder,
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
