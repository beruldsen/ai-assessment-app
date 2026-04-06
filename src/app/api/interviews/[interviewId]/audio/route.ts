import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not set" }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "audio file is required" }, { status: 400 });
    }

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "gpt-4o-mini-transcribe",
    });

    return NextResponse.json({ text: transcription.text ?? "" });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to transcribe audio";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
