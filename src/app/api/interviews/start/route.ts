import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { CAPABILITIES, INTERVIEW_PROMPTS, capabilityIntro, type Capability } from "@/lib/capabilityFramework";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const requested = Array.isArray(body?.capabilities) ? body.capabilities : [];
    const capabilities = requested.filter((item: unknown): item is Capability => CAPABILITIES.includes(item as Capability));
    const selected = capabilities.length ? capabilities : [...CAPABILITIES];
    const first = selected[0];

    const interviewId = randomUUID();

    const seedMessages = [
      {
        id: randomUUID(),
        sender: "assistant",
        content: capabilityIntro(first),
      },
      {
        id: randomUUID(),
        sender: "assistant",
        content: INTERVIEW_PROMPTS[first][0],
      },
    ];

    return NextResponse.json({
      interviewId,
      interview: {
        id: interviewId,
        status: "running",
        capabilities: selected,
        currentCapability: first,
        currentQuestionIndex: 0,
        messages: seedMessages,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
