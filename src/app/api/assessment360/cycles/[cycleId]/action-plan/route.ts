import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

type Ctx = { params: Promise<{ cycleId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { cycleId } = await ctx.params;
  const body = (await req.json()) as {
    strengths?: string;
    priorities?: string;
    plan30?: string;
    plan60?: string;
    plan90?: string;
  };

  const { error } = await supabaseServer.from("assessment360_action_plans").upsert(
    {
      cycle_id: cycleId,
      strengths: body.strengths?.trim() || null,
      priorities: body.priorities?.trim() || null,
      plan_30: body.plan30?.trim() || null,
      plan_60: body.plan60?.trim() || null,
      plan_90: body.plan90?.trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "cycle_id" },
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
