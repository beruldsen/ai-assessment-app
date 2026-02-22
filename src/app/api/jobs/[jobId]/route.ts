import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

type Ctx = { params: Promise<{ jobId: string }> };

export async function GET(_: Request, ctx: Ctx) {
  const { jobId } = await ctx.params;

  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from("jobs")
    .select("id,type,status,attempts,last_error,result,created_at,locked_at,locked_by")
    .eq("id", jobId)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ job: data });
}
