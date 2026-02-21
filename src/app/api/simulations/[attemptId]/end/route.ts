import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

type Ctx = { params: Promise<{ attemptId: string }> };

export async function POST(_: Request, ctx: Ctx) {
  const { attemptId } = await ctx.params;

  if (!attemptId) {
    return NextResponse.json({ error: "attemptId is required" }, { status: 400 });
  }

  const { error } = await supabaseServer
    .from("simulation_attempts")
    .update({ status: "completed" })
    .eq("id", attemptId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
