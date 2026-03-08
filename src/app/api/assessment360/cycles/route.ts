import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getRequestUser } from "@/lib/assessmentAccess";

export async function GET(req: Request) {
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseServer
    .from("assessment360_cycle_participants")
    .select("cycle_id, role, assessment360_cycles!inner(id,title,participant_name,status,created_at)")
    .eq("email", user.email)
    .order("created_at", { ascending: false, referencedTable: "assessment360_cycles" })
    .limit(25, { foreignTable: "assessment360_cycles" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const cycles = (data ?? []).map((row: { role: string; assessment360_cycles: Record<string, unknown> }) => ({
    ...row.assessment360_cycles,
    my_role: row.role,
  }));
  return NextResponse.json({ cycles });
}

export async function POST(req: Request) {
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { title?: string; participantName?: string; managerEmail?: string };

  if (!body.title?.trim() || !body.participantName?.trim() || !body.managerEmail?.trim()) {
    return NextResponse.json({ error: "title, participantName and managerEmail are required" }, { status: 400 });
  }

  const managerEmail = body.managerEmail.trim().toLowerCase();
  const selfEmail = user.email;

  const { data, error } = await supabaseServer
    .from("assessment360_cycles")
    .insert({
      title: body.title.trim(),
      participant_name: body.participantName.trim(),
      status: "open",
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const participants = [
    { cycle_id: data.id, email: selfEmail, role: "self" },
    { cycle_id: data.id, email: managerEmail, role: "manager" },
  ];

  const { error: partErr } = await supabaseServer
    .from("assessment360_cycle_participants")
    .upsert(participants, { onConflict: "cycle_id,email" });

  if (partErr) return NextResponse.json({ error: partErr.message }, { status: 500 });
  return NextResponse.json({ cycleId: data.id });
}
