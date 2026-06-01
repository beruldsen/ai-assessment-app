import { NextResponse } from "next/server";

const REALTIME_MODEL = "gpt-4o-realtime-preview";
const DEFAULT_VOICE = "alloy";

export async function POST() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: REALTIME_MODEL,
        voice: DEFAULT_VOICE,
      }),
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    if (!response.ok) {
      return NextResponse.json({ error: data?.error?.message ?? "Failed to create realtime session" }, { status: response.status });
    }

    return NextResponse.json({
      client_secret: data?.client_secret,
      model: data?.model ?? REALTIME_MODEL,
      voice: data?.voice ?? DEFAULT_VOICE,
      expires_at: data?.expires_at ?? null,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to create realtime session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
