import { NextResponse } from "next/server";

const REALTIME_MODEL = "gpt-realtime";
const DEFAULT_VOICE = "marin";

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 });
  }

  try {
    const sdp = await req.text();
    if (!sdp.trim()) {
      return NextResponse.json({ error: "Missing SDP offer" }, { status: 400 });
    }

    const formData = new FormData();
    formData.set("sdp", sdp);
    const sessionConfig = JSON.stringify({
      type: "realtime",
      model: REALTIME_MODEL,
      audio: {
        output: {
          voice: DEFAULT_VOICE,
        },
      },
    });

    formData.set("session", sessionConfig);

    const response = await fetch(`https://api.openai.com/v1/realtime/calls?model=${encodeURIComponent(REALTIME_MODEL)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    const answerSdp = await response.text();
    if (!response.ok) {
      return NextResponse.json({
        error: answerSdp || "Failed to create realtime call",
        debug: {
          requestUrl: `https://api.openai.com/v1/realtime/calls?model=${encodeURIComponent(REALTIME_MODEL)}`,
          sentSession: sessionConfig,
          sentSdpLength: sdp.length,
          contentType: response.headers.get("content-type"),
          status: response.status,
        },
      }, { status: response.status });
    }

    return new Response(answerSdp, {
      status: 200,
      headers: { "Content-Type": "application/sdp" },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to create realtime call";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
