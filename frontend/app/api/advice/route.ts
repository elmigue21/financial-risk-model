import Groq from "groq-sdk";
import { listMonths } from "../../lib/db";
import { summarizeMonths } from "../../lib/monthly";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are a friendly financial advisor chatting with a small business owner who is NOT a finance expert.
Explain things in plain English, avoid jargon, and keep replies short.
You are given the company's numbers, a computed risk result, and (when available) the owner's month-by-month financial history.
Your job is to give ADVICE — practical, specific recommendations they can act on.

When a FINANCIAL HISTORY is provided, ground your advice in the TREND, not just the latest month: call out whether revenue, profit, cash, debt and risk are improving or deteriorating over time, and tailor advice to that direction.

For your FIRST message (the opening assessment), respond with:
1. One sentence on what the result means for them (mention the trend if history is present).
2. Two or three concrete, practical suggestions to improve or maintain their health.
Keep it under 180 words and do not repeat the raw numbers back.

After that, the owner will either ASK a question or GIVE YOU INFORMATION about their business (often answering something you asked). In BOTH cases your reply must deliver advice:
- If they give you information, briefly acknowledge it, then use that new detail to give MORE SPECIFIC, tailored recommendations than you could before.
- If they ask a question, answer it directly and briefly.
Always finish with a clear, concrete next step. Keep follow-ups under 150 words.
Be encouraging but honest. If asked something outside company finance, gently steer back.`;

const RISK_LABELS: Record<string, string> = {
  LOW_RISK: "low risk",
  MEDIUM_RISK: "medium risk",
  HIGH_RISK: "high risk",
};

export async function POST(req: Request) {
  if (!process.env.GROQ_API_KEY) {
    return new Response(
      "Advisor is not configured. Add GROQ_API_KEY to .env.local to enable AI advice.",
      { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const { inputs, result, riskIndex, messages = [] } = await req.json();

  const isOpening = !Array.isArray(messages) || messages.length === 0;

  // Top drivers from the model's real per-feature contributions.
  const topDrivers = Array.isArray(result?.contributions)
    ? result.contributions
        .filter((c: any) => c?.is_scored_driver)
        .sort((a: any, b: any) => b.contribution - a.contribution)
        .slice(0, 2)
        .map((c: any) => c.label)
    : [];

  // The owner's month-by-month history, so advice can follow the trend.
  let history = "";
  try {
    history = summarizeMonths(listMonths());
  } catch {
    /* no history layer available — advise from the snapshot only */
  }

  const summary = [
    "CONTEXT — this company's health check (latest month):",
    `Risk result: ${RISK_LABELS[result?.risk_level] ?? result?.risk_level}`,
    `Estimated chance of financial trouble: ${Math.round(
      (result?.probability ?? 0) * 100
    )}%`,
    typeof riskIndex === "number" ? `Risk Index (0-100, higher = worse): ${riskIndex}` : "",
    topDrivers.length
      ? `Biggest risk drivers per the model: ${topDrivers.join(", ")}.`
      : "",
    "",
    "The company's reported figures:",
    ...Object.entries(inputs ?? {}).map(([k, v]) => `- ${k}: ${v}`),
    history ? "\n" + history : "",
    "",
    isOpening
      ? "Give the owner their opening assessment now."
      : "Use this context to answer the owner's questions below.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: summary },
        ...(Array.isArray(messages) ? messages : []),
      ],
      temperature: 1,
      // Kept small so prompt + reply stay under the free-tier 8k tokens/min limit.
      max_completion_tokens: 1500,
      top_p: 1,
      // groq-specific field not in the base SDK types
      reasoning_effort: "low",
      stream: true,
    } as any);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of completion as any) {
            const text = chunk?.choices?.[0]?.delta?.content ?? "";
            if (text) controller.enqueue(encoder.encode(text));
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    // Surface the real reason in the server terminal for debugging.
    console.error("[advice] Groq request failed:", err);
    const detail = err instanceof Error ? err.message : "unknown error";
    return new Response(`Could not generate advice right now (${detail}).`, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
