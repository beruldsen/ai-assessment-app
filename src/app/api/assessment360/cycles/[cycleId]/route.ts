import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { cycleHasParticipants, getCycleRole, getRequestUser, isAssessmentAdmin } from "@/lib/assessmentAccess";

type Ctx = { params: Promise<{ cycleId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { cycleId } = await ctx.params;
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await isAssessmentAdmin(user.email);
  const hasParticipants = await cycleHasParticipants(cycleId);
  const participantRole = hasParticipants ? await getCycleRole(cycleId, user.email) : null;

  let viewerRole: "self" | "manager" | "admin" | null = null;
  if (participantRole) {
    // Participant role takes precedence when a user is both participant and admin.
    viewerRole = participantRole;
  } else if (admin) {
    viewerRole = "admin";
  } else if (hasParticipants) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [cycleRes, responsesRes, submissionsRes, actionPlanRes] = await Promise.all([
    supabaseServer
      .from("assessment360_cycles")
      .select("id,title,participant_name,status,created_at")
      .eq("id", cycleId)
      .single(),
    supabaseServer
      .from("assessment360_responses")
      .select("rater_type,question_id,dimension,question_text,score,comment")
      .eq("cycle_id", cycleId),
    supabaseServer
      .from("assessment360_submissions")
      .select("rater_type,status,submitted_at,version")
      .eq("cycle_id", cycleId),
    supabaseServer
      .from("assessment360_action_plans")
      .select("strengths,priorities,plan_30,plan_60,plan_90,updated_at")
      .eq("cycle_id", cycleId)
      .maybeSingle(),
  ]);

  if (cycleRes.error || !cycleRes.data) {
    return NextResponse.json({ error: cycleRes.error?.message ?? "Cycle not found" }, { status: 404 });
  }
  if (responsesRes.error) {
    return NextResponse.json({ error: responsesRes.error.message }, { status: 500 });
  }
  if (submissionsRes.error) {
    return NextResponse.json({ error: submissionsRes.error.message }, { status: 500 });
  }
  if (actionPlanRes.error) {
    return NextResponse.json({ error: actionPlanRes.error.message }, { status: 500 });
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
    viewerRole,
    responses,
    submissions: submissionsRes.data ?? [],
    actionPlan: actionPlanRes.data ?? null,
    summary: { raterAverages, dimensionAverages },
  });
}
