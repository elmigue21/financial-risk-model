import Groq from "groq-sdk";

export const runtime = "nodejs";

/**
 * AI-decided view of which inputs are problematic. Non-streaming: returns
 * structured JSON the dashboard merges into its Insights / Critical Issues
 * sections. The deterministic threshold rules are the fallback, so if the key
 * is missing or the call fails we return an empty flag set (200, not an error).
 */

const FIELD_KEYS = [
  "return_on_assets",
  "profit_margin",
  "interest_coverage",
  "debt_to_equity_ratio",
  "current_ratio",
  "quick_ratio",
] as const;

const SCORED_DRIVERS = [
  "return_on_assets",
  "profit_margin",
  "interest_coverage",
  "debt_to_equity_ratio",
];

const SYSTEM_PROMPT = `You are a credit-risk analyst reviewing a small company's financial ratios.
Decide which inputs are problematic. Weigh BOTH the raw value against healthy norms AND the model's per-feature risk contribution provided to you.
Only these four inputs actually drive the risk model: ${SCORED_DRIVERS.join(", ")}. current_ratio and quick_ratio are informational only — you may flag them as context but never call them model risk drivers.

Respond with STRICT JSON only, matching exactly:
{"flags":[{"field":"<one of the field keys>","severity":"critical|warning|ok","reason":"<one short plain-English sentence>"}]}
Include an entry only for fields that were provided. Keep each reason under 20 words, jargon-free. Do not include any text outside the JSON.`;

const EMPTY = Response.json({ flags: [] });

export async function POST(req: Request) {
  if (!process.env.GROQ_API_KEY) return EMPTY;

  const { inputs, riskIndex, contributions } = await req.json();
  const provided = Object.entries(inputs ?? {}).filter(
    ([k]) => (FIELD_KEYS as readonly string[]).includes(k)
  );
  if (provided.length === 0) return EMPTY;

  const contribLines = (contributions ?? [])
    .filter((c: any) => c?.is_scored_driver && c?.feature)
    .map((c: any) => `- ${c.feature}: contribution ${c.contribution.toFixed(3)}`)
    .join("\n");

  const userMsg = [
    `Risk Index (0-100, higher = worse): ${riskIndex ?? "n/a"}`,
    "",
    "Reported figures:",
    ...provided.map(([k, v]) => `- ${k}: ${v}`),
    "",
    "Model per-feature risk contributions (log-odds, higher = more risk):",
    contribLines || "- none",
  ].join("\n");

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  try {
    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMsg },
      ],
      temperature: 0.3,
      max_completion_tokens: 700,
      top_p: 1,
      reasoning_effort: "low",
      response_format: { type: "json_object" },
    } as any);

    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);
    const flags = Array.isArray(parsed?.flags)
      ? parsed.flags.filter(
          (f: any) =>
            f &&
            (FIELD_KEYS as readonly string[]).includes(f.field) &&
            ["critical", "warning", "ok"].includes(f.severity) &&
            typeof f.reason === "string"
        )
      : [];
    return Response.json({ flags });
  } catch (err) {
    console.error("[flag] Groq request failed:", err);
    return EMPTY;
  }
}
