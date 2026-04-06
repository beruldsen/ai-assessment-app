import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not set" }, { status: 500 });
    }

    const body = await req.json();
    const input = String(body?.input ?? "").trim();

    if (!input) {
      return NextResponse.json({ error: "input is required" }, { status: 400 });
    }

    const response = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      input,
      format: "mp3",
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to synthesize audio";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
