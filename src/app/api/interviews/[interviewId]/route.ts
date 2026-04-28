import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { buildInterviewReport } from "@/lib/interviewReport";

type Ctx = { params: Promise<{ interviewId: string }> };

export async function GET(_: Request, ctx: Ctx) {
  const { interviewId } = await ctx.params;

  if (!interviewId) {
    return NextResponse.json({ error: "interviewId is required" }, { status: 400 });
  }

  const [interviewRes, messagesRes, scoresRes, jobRes] = await Promise.all([
    supabaseServer
      .from("interviews")
      .select("id,status,selected_capabilities,current_capability,started_at,completed_at")
      .eq("id", interviewId)
      .single(),
    supabaseServer
      .from("interview_messages")
      .select("id,capability,role,transcript_text,audio_url,metadata,created_at")
      .eq("interview_id", interviewId)
      .order("created_at", { ascending: true }),
    supabaseServer
      .from("interview_scores")
      .select("id,capability,score,evidence_summary,strengths,development_areas,behavioural_patterns,coaching_recommendations,created_at")
      .eq("interview_id", interviewId)
      .order("capability", { ascending: true }),
    supabaseServer
      .from("jobs")
      .select("id,status,last_error,error,attempts,created_at,updated_at")
      .eq("type", "score_interview")
      .contains("payload", { interviewId })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (interviewRes.error) {
    return NextResponse.json({ error: interviewRes.error.message }, { status: 500 });
  }
  if (messagesRes.error) {
    return NextResponse.json({ error: messagesRes.error.message }, { status: 500 });
  }
  if (scoresRes.error) {
    return NextResponse.json({ error: scoresRes.error.message }, { status: 500 });
  }
  if (jobRes.error) {
    return NextResponse.json({ error: jobRes.error.message }, { status: 500 });
  }

  const scores = scoresRes.data ?? [];
  const messages = messagesRes.data ?? [];
  const job = jobRes.data ?? null;

  return NextResponse.json({
    interview: interviewRes.data,
    messages,
    scores,
    report: scores.length ? buildInterviewReport(scores, messages) : null,
    job,
    telemetry: null,
  });
}
