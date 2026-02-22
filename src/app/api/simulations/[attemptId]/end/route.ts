import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

type Ctx = { params: Promise<{ attemptId: string }> };

export async function POST(_: Request, ctx: Ctx) {
  const { attemptId } = await ctx.params;

  if (!attemptId) {
    return NextResponse.json({ error: "attemptId is required" }, { status: 400 });
  }

  const attemptRes = await supabaseServer
    .from("simulation_attempts")
    .select("id, org_id")
    .eq("id", attemptId)
    .single();

  if (attemptRes.error || !attemptRes.data) {
    return NextResponse.json(
      { error: attemptRes.error?.message ?? "Attempt not found" },
      { status: 500 }
    );
  }

  const updateRes = await supabaseServer
    .from("simulation_attempts")
    .update({ status: "completed" })
    .eq("id", attemptId);

  if (updateRes.error) {
    return NextResponse.json({ error: updateRes.error.message }, { status: 500 });
  }

  const jobRes = await supabaseServer
    .from("jobs")
    .insert({
      type: "score_simulation",
      status: "pending",
      payload: {
        attemptId,
        orgId: attemptRes.data.org_id ?? null,
      },
    })
    .select("id")
    .single();

  if (jobRes.error) {
    return NextResponse.json({ error: jobRes.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, jobId: jobRes.data.id });
}
