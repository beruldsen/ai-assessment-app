import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

type Ctx = { params: Promise<{ attemptId: string }> };

export async function GET(_: Request, ctx: Ctx) {
  const { attemptId } = await ctx.params;

  if (!attemptId) {
    return NextResponse.json({ error: "attemptId is required" }, { status: 400 });
  }

  const [evidenceRes, scoresRes, jobRes] = await Promise.all([
    supabaseServer
      .from("evidence")
      .select("id,domain,indicator,strength,confidence,excerpts,notes,created_at")
      .eq("attempt_id", attemptId)
      .order("created_at", { ascending: true }),
    supabaseServer
      .from("scores")
      .select("id,domain,score,maturity,evidence_count,created_at")
      .eq("attempt_id", attemptId)
      .order("domain", { ascending: true }),
    supabaseServer
      .from("jobs")
      .select("id,status,last_error,result,created_at")
      .eq("type", "score_simulation")
      .contains("payload", { attemptId })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (evidenceRes.error) {
    return NextResponse.json({ error: evidenceRes.error.message }, { status: 500 });
  }
  if (scoresRes.error) {
    return NextResponse.json({ error: scoresRes.error.message }, { status: 500 });
  }
  if (jobRes.error) {
    return NextResponse.json({ error: jobRes.error.message }, { status: 500 });
  }

  return NextResponse.json({
    evidence: evidenceRes.data ?? [],
    scores: scoresRes.data ?? [],
    job: jobRes.data ?? null,
  });
}
