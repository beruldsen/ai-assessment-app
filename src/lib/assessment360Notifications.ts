import { supabaseServer } from "@/lib/supabaseServer";

export async function maybeSendAssessmentCompletionEmails(cycleId: string) {
  const { data: cycle, error: cycleErr } = await supabaseServer
    .from("assessment360_cycles")
    .select("id,title,participant_name,send_completion_email,completion_email_sent_at")
    .eq("id", cycleId)
    .single();

  if (cycleErr || !cycle) return;
  if (!cycle.send_completion_email || cycle.completion_email_sent_at) return;

  const { data: submissions, error: submissionErr } = await supabaseServer
    .from("assessment360_submissions")
    .select("rater_type,status")
    .eq("cycle_id", cycleId);

  if (submissionErr) return;

  const selfDone = submissions?.some((s) => s.rater_type === "self" && s.status === "final_submitted");
  const managerDone = submissions?.some((s) => s.rater_type === "manager" && s.status === "final_submitted");
  if (!selfDone || !managerDone) return;

  const { data: participants, error: participantErr } = await supabaseServer
    .from("assessment360_cycle_participants")
    .select("role,name,email")
    .eq("cycle_id", cycleId)
    .in("role", ["self", "manager"]);

  if (participantErr || !participants?.length) return;

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const reportUrl = origin ? `${origin}/assessment360/${cycleId}/report` : undefined;

  for (const participant of participants) {
    await supabaseServer.auth.signInWithOtp({
      email: participant.email,
      options: {
        emailRedirectTo: reportUrl,
        data: {
          assessment_type: "180-degree capability assessment",
          notification_type: "report_ready",
          role: participant.role,
          recipient_name: participant.name,
          subject_name: cycle.participant_name,
          cycle_title: cycle.title,
          invitation_summary:
            participant.role === "manager"
              ? `${cycle.participant_name}'s Future SE 180 report is ready.`
              : "Your Future SE 180 report is ready.",
          guidance:
            participant.role === "manager"
              ? `Thank you for completing the manager assessment for ${cycle.participant_name}. Both parts of the assessment are now complete, and the report is ready to review.`
              : `Thanks for completing your self assessment. Both parts of the assessment are now complete, and your report for ${cycle.title} is ready to review.`,
          report_link: reportUrl,
        },
      },
    });
  }

  await supabaseServer
    .from("assessment360_cycles")
    .update({ completion_email_sent_at: new Date().toISOString() })
    .eq("id", cycleId);
}
