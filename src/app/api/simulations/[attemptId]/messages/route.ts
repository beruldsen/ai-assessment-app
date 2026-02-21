import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

type Ctx = { params: Promise<{ attemptId: string }> };

export async function GET(_: Request, ctx: Ctx) {
  const { attemptId } = await ctx.params;

  if (!attemptId) {
    return NextResponse.json({ error: "attemptId is required" }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from("simulation_messages")
    .select("id,sender,content,created_at")
    .eq("attempt_id", attemptId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ messages: data ?? [] });
}
