import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
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

async function sendMagicLink(email: string, redirectTo?: string) {
  const authClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { error } = await authClient.auth.signInWithOtp({
    email,
    options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
  });
  return { ok: !error, error: error?.message ?? null };
}

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

  const cycles = (data ?? []).map((row: {
    role: string;
    invite_status: string;
    assessment360_cycles: Record<string, unknown>;
  }) => ({
    ...row.assessment360_cycles,
    my_role: row.role,
    invite_status: row.invite_status,
  }));
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

  const participantsBase = [
    { cycle_id: data.id, role: "self" as const, name: body.selfName.trim(), email: selfEmail },
    { cycle_id: data.id, role: "manager" as const, name: body.managerName.trim(), email: managerEmail },
  ];

  const origin = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? undefined;
  const redirectTo = origin ? `${origin}/assessment360/${data.id}` : undefined;

  const inviteResults = await Promise.all(
    participantsBase.map(async (p) => {
      const sent = await sendMagicLink(p.email, redirectTo);
      return {
        ...p,
        invite_status: sent.ok ? "sent" : "failed",
        invite_sent_at: sent.ok ? new Date().toISOString() : null,
        invite_error: sent.error,
      } satisfies ParticipantRow;
    }),
  );

  const { error: partErr } = await supabaseServer
    .from("assessment360_cycle_participants")
    .upsert(inviteResults, { onConflict: "cycle_id,email" });

  if (partErr) return NextResponse.json({ error: partErr.message }, { status: 500 });
  return NextResponse.json({ cycleId: data.id, invites: inviteResults });
}
