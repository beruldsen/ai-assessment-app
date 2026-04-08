import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { CAPABILITIES, INTERVIEW_PROMPTS, interviewWelcomeIntro, capabilityIntro, type Capability } from "@/lib/capabilityFramework";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const requested = Array.isArray(body?.capabilities) ? body.capabilities : [];
    const capabilities = requested.filter((item: unknown): item is Capability => CAPABILITIES.includes(item as Capability));
    const selected = capabilities.length ? capabilities : [...CAPABILITIES];
    const first = selected[0];

    const { data: interview, error: interviewErr } = await supabaseServer
      .from("interviews")
      .insert({
        org_id: body?.orgId ?? null,
        user_id: body?.userId ?? null,
        status: "running",
        selected_capabilities: selected,
        current_capability: first,
      })
      .select("id,status,selected_capabilities,current_capability,started_at")
      .single();

    if (interviewErr || !interview) {
      return NextResponse.json({ error: interviewErr?.message ?? "Failed to start interview" }, { status: 500 });
    }

    const seedMessages = [
      { role: "assistant", transcript_text: interviewWelcomeIntro(), capability: first, metadata: { mode: "voice", kind: "welcome" } },
      { role: "assistant", transcript_text: capabilityIntro(first), capability: first, metadata: { mode: "voice", kind: "capability_intro" } },
      { role: "assistant", transcript_text: INTERVIEW_PROMPTS[first][0], capability: first, metadata: { mode: "voice", kind: "question" } },
    ];

    const { error: seedErr } = await supabaseServer.from("interview_messages").insert(
      seedMessages.map((item) => ({ interview_id: interview.id, ...item }))
    );

    if (seedErr) {
      return NextResponse.json({ error: seedErr.message }, { status: 500 });
    }

    return NextResponse.json({
      interviewId: interview.id,
      interview,
      voice: {
        mode: "turn_based",
        input: "microphone_primary",
        fallback: "text",
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
