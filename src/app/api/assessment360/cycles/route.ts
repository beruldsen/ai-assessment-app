import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET() {
  const { data, error } = await supabaseServer
    .from("assessment360_cycles")
    .select("id,title,participant_name,status,created_at")
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ cycles: data ?? [] });
}

export async function POST(req: Request) {
  const body = (await req.json()) as { title?: string; participantName?: string };

  if (!body.title?.trim() || !body.participantName?.trim()) {
    return NextResponse.json({ error: "title and participantName are required" }, { status: 400 });
  }

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
  return NextResponse.json({ cycleId: data.id });
}
