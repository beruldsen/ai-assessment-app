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

export async function GET(req: Request) {
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await isAssessmentAdmin(user.email);

  if (admin) {
    const { data, error } = await supabaseServer
      .from("assessment360_cycles")
      .select("id,title,participant_name,status,created_at,assessment360_cycle_participants(role,email,name,invite_status,invite_sent_at)")
      .order("created_at", { ascending: false })
      .limit(25);

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
  const cycleUrl = `${origin}/assessment360/${data.id}`;

  const inviteTargets: Array<Pick<ParticipantRow, "role" | "email" | "name">> = [
    { role: "self", email: selfEmail, name: body.selfName.trim() },
    { role: "manager", email: managerEmail, name: body.managerName.trim() },
  ];

  const inviteUpdates: ParticipantRow[] = [];

  for (const target of inviteTargets) {
    const { error: inviteErr } = await supabaseServer.auth.signInWithOtp({
      email: target.email,
      options: {
        emailRedirectTo: cycleUrl,
      },
    });

    inviteUpdates.push({
      cycle_id: data.id,
      role: target.role,
      name: target.name,
      email: target.email,
      invite_status: inviteErr ? "failed" : "sent",
      invite_sent_at: inviteErr ? null : new Date().toISOString(),
      invite_error: inviteErr ? inviteErr.message : null,
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
