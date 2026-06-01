import OpenAI from "openai";
import { NextResponse } from "next/server";

const REALTIME_MODEL = "gpt-4o-realtime-preview";
const DEFAULT_VOICE = "alloy";

export async function POST() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 });
  }

  try {
    const openai = new OpenAI({ apiKey });
    const session = await openai.realtime.clientSecrets.create({
      session: {
        type: "realtime",
        model: REALTIME_MODEL,
        audio: {
          output: {
            voice: DEFAULT_VOICE,
          },
        },
      },
    });

    const realtimeSession = session.session && session.session.type === "realtime" ? session.session : null;

    return NextResponse.json({
      client_secret: {
        value: session.value,
        expires_at: session.expires_at,
      },
      model: realtimeSession?.model ?? REALTIME_MODEL,
      voice: realtimeSession?.audio?.output?.voice ?? DEFAULT_VOICE,
      expires_at: session.expires_at ?? null,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to create realtime session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
