import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET() {
  const { data, error } = await supabaseServer
    .from("organizations")
    .select("*")
    .limit(1);

  return NextResponse.json({ data, error });
}
