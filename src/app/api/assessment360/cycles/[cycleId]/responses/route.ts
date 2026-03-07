import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { ASSESSMENT_360_QUESTIONS, type RaterType } from "@/lib/assessment360";

type Ctx = { params: Promise<{ cycleId: string }> };

type AnswerInput = { questionId: string; score: number; comment?: string };

export async function POST(req: Request, ctx: Ctx) {
  const { cycleId } = await ctx.params;
  const body = (await req.json()) as { raterType?: RaterType; answers?: AnswerInput[] };

  if (body.raterType !== "self" && body.raterType !== "manager") {
    return NextResponse.json({ error: "raterType must be self or manager" }, { status: 400 });
  }

  const answers = body.answers ?? [];
  if (!answers.length) {
    return NextResponse.json({ error: "answers are required" }, { status: 400 });
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
      dimension: q.dimension,
      question_text: q.text,
      score: Math.round(a.score),
      comment: a.comment?.trim() ? a.comment.trim() : null,
    });
  }

  const { error } = await supabaseServer
    .from("assessment360_responses")
    .upsert(rows, { onConflict: "cycle_id,rater_type,question_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, count: rows.length });
}
