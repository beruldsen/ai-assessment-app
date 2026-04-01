import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { ASSESSMENT_360_QUESTIONS, type RaterType } from "@/lib/assessment360";
import { cycleHasParticipants, getCycleRole, getRequestUser, isAssessmentAdmin } from "@/lib/assessmentAccess";
import { maybeSendAssessmentCompletionEmails } from "@/lib/assessment360Notifications";

type Ctx = { params: Promise<{ cycleId: string }> };

type AnswerInput = { questionId: string; score: number; comment?: string };

export async function POST(req: Request, ctx: Ctx) {
  const { cycleId } = await ctx.params;
  const body = (await req.json()) as {
    raterType?: RaterType;
    answers?: AnswerInput[];
    mode?: "draft" | "final";
    forceEditAfterFinal?: boolean;
  };

  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (body.raterType !== "self" && body.raterType !== "manager") {
    return NextResponse.json({ error: "raterType must be self or manager" }, { status: 400 });
  }

  const admin = await isAssessmentAdmin(user.email);
  const url = new URL(req.url);
  const forceAdmin = url.searchParams.get("as") === "admin";
  const hasParticipants = await cycleHasParticipants(cycleId);
  const participantRole = hasParticipants ? await getCycleRole(cycleId, user.email) : null;

  if (hasParticipants && !participantRole && !admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // If this user is explicitly a participant in the cycle, lock them to their own rater type
  // even if they also have admin capability, unless explicitly forcing admin mode.
  if (participantRole && body.raterType !== participantRole && !(forceAdmin && admin)) {
    return NextResponse.json({ error: `Forbidden: ${participantRole} can only submit ${participantRole} ratings.` }, { status: 403 });
  }

  const mode = body.mode === "final" ? "final" : "draft";
  const answers = body.answers ?? [];
  if (!answers.length) {
    return NextResponse.json({ error: "answers are required" }, { status: 400 });
  }

  const existingSubmission = await supabaseServer
    .from("assessment360_submissions")
    .select("status,version")
    .eq("cycle_id", cycleId)
    .eq("rater_type", body.raterType)
    .maybeSingle();

  if (existingSubmission.error) {
    return NextResponse.json({ error: existingSubmission.error.message }, { status: 500 });
  }

  if (existingSubmission.data?.status === "final_submitted" && !body.forceEditAfterFinal) {
    return NextResponse.json(
      { error: `${body.raterType} submission is finalized. Reopen before editing.` },
      { status: 409 },
    );
  }

  const byId = new Map(ASSESSMENT_360_QUESTIONS.map((q) => [q.id, q]));
  const rows = [] as Array<{
    cycle_id: string;
    rater_type: RaterType;
    question_id: string;
    dimension: string;
    question_text: string;
    score: number;
    comment: string | null;
  }>;

  for (const a of answers) {
    const q = byId.get(a.questionId);
    if (!q) {
      return NextResponse.json({ error: `Unknown questionId: ${a.questionId}` }, { status: 400 });
    }
    if (!Number.isFinite(a.score) || a.score < 1 || a.score > 5) {
      return NextResponse.json({ error: `Invalid score for ${a.questionId}` }, { status: 400 });
    }

    rows.push({
      cycle_id: cycleId,
      rater_type: body.raterType,
      question_id: q.id,
      dimension: q.capability,
      question_text: q.text,
      score: Math.round(a.score),
      comment: a.comment?.trim() ? a.comment.trim() : null,
    });
  }

  const { error: saveError } = await supabaseServer
    .from("assessment360_responses")
    .upsert(rows, { onConflict: "cycle_id,rater_type,question_id" });

  if (saveError) return NextResponse.json({ error: saveError.message }, { status: 500 });

  const nextStatus = mode === "final" ? "final_submitted" : "draft";
  const prevVersion = existingSubmission.data?.version ?? 0;

  const { error: submissionError } = await supabaseServer
    .from("assessment360_submissions")
    .upsert(
      {
        cycle_id: cycleId,
        rater_type: body.raterType,
        status: nextStatus,
        submitted_at: mode === "final" ? new Date().toISOString() : null,
        submitted_by: user.email,
        version: prevVersion + 1,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "cycle_id,rater_type" },
    );

  if (submissionError) return NextResponse.json({ error: submissionError.message }, { status: 500 });

  if (nextStatus === "final_submitted") {
    await maybeSendAssessmentCompletionEmails(cycleId);
  }

  return NextResponse.json({ ok: true, count: rows.length, status: nextStatus });
}
