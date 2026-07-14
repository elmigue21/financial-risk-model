import Groq from "groq-sdk";
import { listMonths } from "../../lib/db";
import { getSession } from "../../lib/session";
import { summarizeMonths } from "../../lib/monthly";

export const runtime = "nodejs";

/**
 * AI-generated follow-up questions the owner can tap in the advisor panel.
 * Regenerated from the live conversation after each reply. The prompt biases
 * toward questions that surface THIS business's specifics (industry, product,
 * customers, seasonality, costs) so the advisor's advice becomes tailored.
 * Non-streaming JSON. Empty list on missing key / failure (chips just hide).
 */

const RISK_LABELS: Record<string, string> = {
  LOW_RISK: "low risk",
  MEDIUM_RISK: "medium risk",
  HIGH_RISK: "high risk",
};

const SYSTEM_PROMPT = `You are a financial advisor. Generate questions that GATHER FACTUAL INFORMATION about the owner's business, so you can later give precise, tailored advice.
Generate exactly 3 questions, addressed TO the owner in second person.
Rules:
- Ask for facts the owner already knows off the top of their head — NOT projections, calculations, or analysis. Never ask "how much could you generate/save" or "what if sales dropped"; those make the owner do the work.
- Gather concrete business context that explains the weak areas below: what they sell and to whom, cost structure, how they're financed, customers, inventory, pricing, team.
- Good examples:
  · "What does your business sell, and who are your main customers?"
  · "What are your three biggest monthly expenses?"
  · "Are your loans short-term or long-term, and at what interest rates?"
  · "How much of your sales come from your single largest customer?"
  · "Do you carry much inventory, and how quickly does it sell?"
- One clear fact per question. Avoid vague or yes/no-only questions.
- Don't repeat anything the owner already told you, and don't ask for numbers already shown in their financial history — ask about the STORY behind the trends instead (e.g. what changed the month cash dropped).
- Each under 16 words, plain English, ends in "?", no numbering, no quotes.
Return STRICT JSON only: {"questions":["...","...","..."]}`;

const EMPTY = Response.json({ questions: [] });

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Not signed in." }, { status: 401 });

  if (!process.env.GROQ_API_KEY) return EMPTY;

  const { inputs, result, riskIndex, messages = [] } = await req.json();

  const topDrivers = Array.isArray(result?.contributions)
    ? result.contributions
        .filter((c: any) => c?.is_scored_driver)
        .sort((a: any, b: any) => b.contribution - a.contribution)
        .slice(0, 2)
        .map((c: any) => c.label)
    : [];

  const transcript = (Array.isArray(messages) ? messages : [])
    .slice(-4)
    .map((m: any) => `${m.role === "user" ? "Owner" : "Advisor"}: ${m.content}`)
    .join("\n");

  const figures = Object.entries(inputs ?? {}).map(([k, v]) => `- ${k}: ${v}`);

  let history = "";
  try {
    history = summarizeMonths(listMonths(session.userId));
  } catch {
    /* no history layer — fall back to the single snapshot */
  }

  const userMsg = [
    "CONTEXT:",
    `Risk: ${RISK_LABELS[result?.risk_level] ?? result?.risk_level} (index ${riskIndex ?? "n/a"}).`,
    topDrivers.length ? `Biggest risk drivers: ${topDrivers.join(", ")}.` : "",
    figures.length ? "Reported figures (latest month):" : "",
    ...figures,
    history ? "\n" + history : "",
    "",
    "Recent conversation:",
    transcript || "(only the opening assessment so far)",
    "",
    "Give 3 questions you want to ask the owner about their business now.",
  ]
    .filter(Boolean)
    .join("\n");

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  try {
    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMsg },
      ],
      temperature: 0.7,
      max_completion_tokens: 400,
      top_p: 1,
      reasoning_effort: "low",
      response_format: { type: "json_object" },
    } as any);

    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);
    const questions = Array.isArray(parsed?.questions)
      ? parsed.questions
          .filter((q: any) => typeof q === "string" && q.trim())
          .map((q: string) => q.trim())
          .slice(0, 4)
      : [];
    return Response.json({ questions });
  } catch (err) {
    console.error("[suggestions] Groq request failed:", err);
    return EMPTY;
  }
}
