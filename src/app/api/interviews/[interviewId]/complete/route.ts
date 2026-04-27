import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

type Ctx = { params: Promise<{ interviewId: string }> };

export async function POST(_: Request, ctx: Ctx) {
  const { interviewId } = await ctx.params;

  if (!interviewId) {
    return NextResponse.json({ error: "interviewId is required" }, { status: 400 });
  }

  const updateRes = await supabaseServer
    .from("interviews")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", interviewId);

  if (updateRes.error) {
    return NextResponse.json({ error: updateRes.error.message }, { status: 500 });
  }

  const jobRes = await supabaseServer
    .from("jobs")
    .insert({
      type: "score_interview",
      status: "pending",
      payload: { interviewId },
      error: null,
    })
    .select("id")
    .single();

  if (jobRes.error) {
    return NextResponse.json({ error: jobRes.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, jobId: jobRes.data.id });
}
