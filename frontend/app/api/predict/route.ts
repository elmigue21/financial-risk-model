import { NextResponse } from "next/server";

// Where the Python model service runs. Override with MODEL_API_URL in .env.local.
const MODEL_API_URL = process.env.MODEL_API_URL ?? "http://localhost:5000";

export async function POST(req: Request) {
  const inputs = await req.json();

  try {
    const res = await fetch(`${MODEL_API_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(inputs),
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Model service returned an error." },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Could not reach the model service. Is it running?" },
      { status: 502 }
    );
  }
}
