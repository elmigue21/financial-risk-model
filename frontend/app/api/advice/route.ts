import Groq from "groq-sdk";
import { listMonths } from "../../lib/db";
import { getSession } from "../../lib/session";
import { summarizeMonths } from "../../lib/monthly";
import { FIELDS } from "../../fields";
import {
  classifyRatio,
  formatValue,
  healthScore,
  indexBand,
  riskIndex as riskIndexOf,
} from "../../lib/scoring";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are a friendly financial advisor chatting with a small business owner who is NOT a finance expert.
Explain things in plain English, avoid jargon, and keep replies short.
You are given the company's DASHBOARD — its health score, risk index, every financial ratio with a plain-English status (Healthy / Weak / Poor / Critical), the biggest risk drivers, and (when available) the owner's month-by-month history.
Your job is to give ADVICE — practical, specific recommendations they can act on.

INTERPRET THE WHOLE DASHBOARD, not just the single biggest risk driver. Read across all the KPIs — health score, risk index, and each ratio's status — and explain what they mean together (e.g. "profitability is fine but liquidity is the weak spot"). Give the strongest ratios their due, then focus effort on the weak ones.
When a FINANCIAL HISTORY is provided, also ground your advice in the TREND: call out whether revenue, profit, cash, debt and risk are improving or deteriorating over time, and tailor advice to that direction.

For your FIRST message (the opening assessment), respond with:
1. One sentence on what the result means for them (mention the trend if history is present).
2. Two or three concrete, practical suggestions to improve or maintain their health.
Keep it under 180 words and do not repeat the raw numbers back.

After that, the owner will either ASK a question or GIVE YOU INFORMATION about their business (often answering something you asked). In BOTH cases your reply must deliver advice:
- If they give you information, briefly acknowledge it, then use that new detail to give MORE SPECIFIC, tailored recommendations than you could before.
- If they ask a question, answer it directly and briefly.
Always finish with a clear, concrete next step. Keep follow-ups under 150 words.
Be encouraging but honest. If asked something outside company finance, gently steer back.`;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return new Response("Not signed in.", { status: 401 });

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
    history = summarizeMonths(listMonths(session.userId));
  } catch {
    /* no history layer available — advise from the snapshot only */
  }

  // Dashboard KPIs, interpreted the same way the UI shows them, so the advisor
  // reads across ALL the numbers rather than only the top risk driver.
  const idx =
    typeof riskIndex === "number" ? riskIndex : riskIndexOf(result?.probability ?? 0);
  const kpiLines = FIELDS.filter((f) => inputs?.[f.key] !== undefined).map((f) => {
    const status = classifyRatio(f, inputs[f.key]);
    return `- ${f.shortLabel}: ${formatValue(f, inputs[f.key])} — ${status.status}${
      f.used ? "" : " (context only, not scored)"
    }`;
  });

  const summary = [
    "DASHBOARD — this company's latest month:",
    `Health score: ${healthScore(result?.probability ?? 0)}/100`,
    `Risk index: ${idx}/100 (${indexBand(idx).label})`,
    `Estimated chance of financial trouble: ${Math.round(
      (result?.probability ?? 0) * 100
    )}%`,
    topDrivers.length ? `Biggest risk drivers per the model: ${topDrivers.join(", ")}.` : "",
    "",
    "Financial ratios and their status:",
    ...kpiLines,
    history ? "\n" + history : "",
    "",
    isOpening
      ? "Give the owner their opening assessment now, interpreting the dashboard as a whole."
      : "Use this dashboard context to answer the owner's questions below.",
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
