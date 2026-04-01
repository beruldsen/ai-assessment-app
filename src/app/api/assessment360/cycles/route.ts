import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getRequestUser, isAssessmentAdmin } from "@/lib/assessmentAccess";

type ParticipantRow = {
  cycle_id: string;
  role: "self" | "manager";
  name: string;
  email: string;
  invite_status: "pending" | "sent" | "failed";
  invite_sent_at: string | null;
  invite_error: string | null;
};

type CycleInvitePayload = {
  title: string;
  selfName: string;
  managerName: string;
};

async function sendAssessmentInvite({
  email,
  role,
  recipientName,
  cycleId,
  cycle,
  origin,
}: {
  email: string;
  role: "self" | "manager";
  recipientName: string;
  cycleId: string;
  cycle: CycleInvitePayload;
  origin: string;
}) {
  const cycleUrl = `${origin}/assessment360/${cycleId}`;
  const counterpart = role === "self" ? cycle.managerName : cycle.selfName;

  const { error: inviteErr } = await supabaseServer.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: cycleUrl,
      data: {
        assessment_type: "180-degree capability assessment",
        assessment_perspective: role === "self" ? "self assessment" : "manager assessment",
        role,
        recipient_name: recipientName,
        counterpart_name: counterpart,
        subject_name: cycle.selfName,
        manager_name: cycle.managerName,
        cycle_title: cycle.title,
        development_focus: "This assessment supports growth and capability development, not performance management.",
        invitation_summary:
          role === "self"
            ? `You are invited to complete your self assessment for ${cycle.title}.`
            : `You are invited to complete a manager assessment for ${cycle.selfName} as part of ${cycle.title}.`,
        guidance:
          role === "self"
            ? "Please reflect honestly on demonstrated behaviours and use comments for specific examples."
            : `Please complete this from a manager perspective for ${cycle.selfName}, rating observed behaviours and adding constructive, evidence-based feedback.`,
        assessment_link: cycleUrl,
      },
    },
  });

  return {
    cycle_id: cycleId,
    role,
    name: recipientName,
    email,
    invite_status: inviteErr ? "failed" as const : "sent" as const,
    invite_sent_at: inviteErr ? null : new Date().toISOString(),
    invite_error: inviteErr ? inviteErr.message : null,
    cycleUrl,
  };
}

export async function GET(req: Request) {
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await isAssessmentAdmin(user.email);

  if (admin) {
    const { data, error } = await supabaseServer
      .from("assessment360_cycles")
      .select("id,title,participant_name,status,created_at,assessment360_cycle_participants(role,email,name,invite_status,invite_sent_at,invite_error),assessment360_submissions(rater_type,status,submitted_at,version)")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ cycles: data ?? [], isAdmin: true });
  }

  const { data, error } = await supabaseServer
    .from("assessment360_cycle_participants")
    .select("cycle_id, role, invite_status, assessment360_cycles!inner(id,title,participant_name,status,created_at)")
    .eq("email", user.email)
    .order("created_at", { ascending: false, referencedTable: "assessment360_cycles" })
    .limit(25, { foreignTable: "assessment360_cycles" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type JoinedCycle = {
    id: string;
    title: string;
    participant_name: string;
    status: string;
    created_at: string;
  };

  const cycles = (data ?? []).flatMap((row: {
    role: string;
    invite_status: string;
    assessment360_cycles: JoinedCycle[];
  }) => {
    const cycle = row.assessment360_cycles?.[0];
    if (!cycle) return [];

    return {
      ...cycle,
      my_role: row.role,
      invite_status: row.invite_status,
    };
  });
  return NextResponse.json({ cycles, isAdmin: false });
}

export async function PATCH(req: Request) {
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await isAssessmentAdmin(user.email);
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const body = (await req.json()) as {
    cycleId?: string;
    role?: "self" | "manager";
  };

  if (!body.cycleId || !body.role) {
    return NextResponse.json({ error: "cycleId and role are required" }, { status: 400 });
  }

  const { data: cycle, error: cycleErr } = await supabaseServer
    .from("assessment360_cycles")
    .select("id,title,participant_name")
    .eq("id", body.cycleId)
    .single();

  if (cycleErr || !cycle) return NextResponse.json({ error: cycleErr?.message ?? "Cycle not found" }, { status: 404 });

  const { data: participants, error: partErr } = await supabaseServer
    .from("assessment360_cycle_participants")
    .select("cycle_id,role,name,email,invite_status,invite_sent_at,invite_error")
    .eq("cycle_id", body.cycleId);

  if (partErr) return NextResponse.json({ error: partErr.message }, { status: 500 });

  const target = (participants ?? []).find((p) => p.role === body.role);
  const manager = (participants ?? []).find((p) => p.role === "manager");

  if (!target) return NextResponse.json({ error: `No ${body.role} participant found for this cycle` }, { status: 404 });

  const origin = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const inviteResult = await sendAssessmentInvite({
    email: target.email,
    role: target.role,
    recipientName: target.name,
    cycleId: body.cycleId,
    cycle: {
      title: cycle.title,
      selfName: cycle.participant_name,
      managerName: manager?.name ?? "Manager",
    },
    origin,
  });

  const { error: persistErr } = await supabaseServer
    .from("assessment360_cycle_participants")
    .upsert([
      {
        cycle_id: inviteResult.cycle_id,
        role: inviteResult.role,
        name: inviteResult.name,
        email: inviteResult.email,
        invite_status: inviteResult.invite_status,
        invite_sent_at: inviteResult.invite_sent_at,
        invite_error: inviteResult.invite_error,
      },
    ], { onConflict: "cycle_id,email" });

  if (persistErr) return NextResponse.json({ error: persistErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    result: {
      role: inviteResult.role,
      email: inviteResult.email,
      status: inviteResult.invite_status,
      error: inviteResult.invite_error,
    },
    message:
      inviteResult.invite_status === "sent"
        ? `${inviteResult.role} invite resent successfully.`
        : `${inviteResult.role} invite resend failed: ${inviteResult.invite_error ?? "unknown error"}`,
  });
}

export async function POST(req: Request) {
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await isAssessmentAdmin(user.email);
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const body = (await req.json()) as {
    title?: string;
    selfName?: string;
    selfEmail?: string;
    managerName?: string;
    managerEmail?: string;
  };

  if (!body.title?.trim() || !body.selfName?.trim() || !body.selfEmail?.trim() || !body.managerName?.trim() || !body.managerEmail?.trim()) {
    return NextResponse.json({ error: "title, selfName, selfEmail, managerName, managerEmail are required" }, { status: 400 });
  }

  const selfEmail = body.selfEmail.trim().toLowerCase();
  const managerEmail = body.managerEmail.trim().toLowerCase();

  if (selfEmail === managerEmail) {
    return NextResponse.json({ error: "Self and manager emails must be different" }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from("assessment360_cycles")
    .insert({
      title: body.title.trim(),
      participant_name: body.selfName.trim(),
      status: "open",
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const participants: ParticipantRow[] = [
    {
      cycle_id: data.id,
      role: "self",
      name: body.selfName.trim(),
      email: selfEmail,
      invite_status: "pending",
      invite_sent_at: null,
      invite_error: null,
    },
    {
      cycle_id: data.id,
      role: "manager",
      name: body.managerName.trim(),
      email: managerEmail,
      invite_status: "pending",
      invite_sent_at: null,
      invite_error: null,
    },
  ];

  const { error: partErr } = await supabaseServer
    .from("assessment360_cycle_participants")
    .upsert(participants, { onConflict: "cycle_id,email" });

  if (partErr) return NextResponse.json({ error: partErr.message }, { status: 500 });

  const origin = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";

  const cycleMeta: CycleInvitePayload = {
    title: body.title.trim(),
    selfName: body.selfName.trim(),
    managerName: body.managerName.trim(),
  };

  const inviteTargets: Array<Pick<ParticipantRow, "role" | "email" | "name">> = [
    { role: "self", email: selfEmail, name: body.selfName.trim() },
    { role: "manager", email: managerEmail, name: body.managerName.trim() },
  ];

  const inviteUpdates: ParticipantRow[] = [];
  let cycleUrl = `${origin}/assessment360/${data.id}`;

  for (const target of inviteTargets) {
    const inviteResult = await sendAssessmentInvite({
      email: target.email,
      role: target.role,
      recipientName: target.name,
      cycleId: data.id,
      cycle: cycleMeta,
      origin,
    });

    cycleUrl = inviteResult.cycleUrl;
    inviteUpdates.push({
      cycle_id: inviteResult.cycle_id,
      role: inviteResult.role,
      name: inviteResult.name,
      email: inviteResult.email,
      invite_status: inviteResult.invite_status,
      invite_sent_at: inviteResult.invite_sent_at,
      invite_error: inviteResult.invite_error,
    });
  }

  const { error: invitePersistErr } = await supabaseServer
    .from("assessment360_cycle_participants")
    .upsert(inviteUpdates, { onConflict: "cycle_id,email" });

  if (invitePersistErr) return NextResponse.json({ error: invitePersistErr.message }, { status: 500 });

  const failedCount = inviteUpdates.filter((i) => i.invite_status === "failed").length;

  return NextResponse.json({
    cycleId: data.id,
    links: {
      self: cycleUrl,
      manager: cycleUrl,
      login: `${origin}/login`,
    },
    inviteResults: inviteUpdates.map((i) => ({ role: i.role, email: i.email, status: i.invite_status, error: i.invite_error })),
    message:
      failedCount === 0
        ? "Cycle created and invite emails sent to self + manager."
        : `Cycle created, but ${failedCount} invite email(s) failed. See inviteResults for details.`,
  });
}
