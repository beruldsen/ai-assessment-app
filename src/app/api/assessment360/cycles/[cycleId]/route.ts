import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

type Ctx = { params: Promise<{ cycleId: string }> };

export async function GET(_: Request, ctx: Ctx) {
  const { cycleId } = await ctx.params;

  const [cycleRes, responsesRes] = await Promise.all([
    supabaseServer
      .from("assessment360_cycles")
      .select("id,title,participant_name,status,created_at")
      .eq("id", cycleId)
      .single(),
    supabaseServer
      .from("assessment360_responses")
      .select("rater_type,question_id,dimension,question_text,score,comment")
      .eq("cycle_id", cycleId),
  ]);

  if (cycleRes.error || !cycleRes.data) {
    return NextResponse.json({ error: cycleRes.error?.message ?? "Cycle not found" }, { status: 404 });
  }
  if (responsesRes.error) {
    return NextResponse.json({ error: responsesRes.error.message }, { status: 500 });
  }

  const responses = responsesRes.data ?? [];

  const byRater: Record<string, { total: number; count: number }> = {};
  const byDimension: Record<string, { total: number; count: number }> = {};

  for (const r of responses) {
    byRater[r.rater_type] ??= { total: 0, count: 0 };
    byRater[r.rater_type].total += r.score;
    byRater[r.rater_type].count += 1;

    byDimension[r.dimension] ??= { total: 0, count: 0 };
    byDimension[r.dimension].total += r.score;
    byDimension[r.dimension].count += 1;
  }

  const raterAverages = Object.entries(byRater).map(([raterType, v]) => ({
    raterType,
    avgScore: v.count ? Number((v.total / v.count).toFixed(2)) : 0,
  }));

  const dimensionAverages = Object.entries(byDimension).map(([dimension, v]) => ({
    dimension,
    avgScore: v.count ? Number((v.total / v.count).toFixed(2)) : 0,
  }));

  return NextResponse.json({
    cycle: cycleRes.data,
    responses,
    summary: { raterAverages, dimensionAverages },
  });
}
