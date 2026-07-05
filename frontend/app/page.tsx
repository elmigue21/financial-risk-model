"use client";

import { useRef, useState } from "react";
import { FIELDS, FieldKey, PredictResult } from "./fields";

type FormState = Record<FieldKey, string>;
type ChatMessage = { role: "user" | "assistant"; content: string };

const EMPTY_FORM = Object.fromEntries(
  FIELDS.map((f) => [f.key, ""])
) as FormState;

const RISK_INFO: Record<
  PredictResult["risk_level"],
  { label: string; order: number; text: string; color: string; bar: string }
> = {
  LOW_RISK: {
    label: "Low Risk",
    order: 0,
    text: "Your finances look healthy. Keep doing what you're doing.",
    color: "text-low",
    bar: "bg-low",
  },
  MEDIUM_RISK: {
    label: "Medium Risk",
    order: 1,
    text: "Some warning signs. Worth keeping a close eye on things.",
    color: "text-medium",
    bar: "bg-medium",
  },
  HIGH_RISK: {
    label: "High Risk",
    order: 2,
    text: "Elevated risk of financial trouble. Consider acting soon.",
    color: "text-high",
    bar: "bg-high",
  },
};

const RISK_STEPS = [
  { name: "Low", bar: "bg-low", text: "text-low" },
  { name: "Medium", bar: "bg-medium", text: "text-medium" },
  { name: "High", bar: "bg-high", text: "text-high" },
];

/** Render **bold** spans inside a line of advice. */
function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

/** Turn the LLM's text into tidy, readable paragraphs. */
function FormattedText({ text }: { text: string }) {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.replace(/^#+\s*/, ""));

  return (
    <div className="flex flex-col gap-2">
      {lines.map((line, i) => (
        <p key={i} className="text-sm leading-relaxed">
          {renderInline(line)}
        </p>
      ))}
    </div>
  );
}

export default function Home() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [result, setResult] = useState<PredictResult | null>(null);
  const [inputs, setInputs] = useState<Record<string, number>>({});
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatting, setChatting] = useState(false);
  const [error, setError] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  function update(key: FieldKey, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    setMessages([]);

    const parsed: Record<string, number> = {};
    for (const f of FIELDS) {
      const raw = form[f.key].trim();
      if (raw !== "") parsed[f.key] = Number(raw);
    }

    try {
      const res = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      if (!res.ok) throw new Error("The model service is not reachable.");
      const data: PredictResult = await res.json();
      setResult(data);
      setInputs(parsed);
      // Kick off the advisor's opening assessment (empty conversation).
      streamReply([], parsed, data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  /** Send the conversation so far to the advisor and stream the reply in. */
  async function streamReply(
    convo: ChatMessage[],
    ctxInputs: Record<string, number>,
    ctxResult: PredictResult
  ) {
    setChatting(true);
    setMessages([...convo, { role: "assistant", content: "" }]);
    try {
      const res = await fetch("/api/advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputs: ctxInputs,
          result: ctxResult,
          messages: convo,
        }),
      });
      if (!res.ok || !res.body) throw new Error("no stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = {
            role: "assistant",
            content: copy[copy.length - 1].content + chunk,
          };
          return copy;
        });
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    } catch {
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          role: "assistant",
          content: "Sorry, I couldn't respond right now.",
        };
        return copy;
      });
    } finally {
      setChatting(false);
    }
  }

  function onSend(e: React.FormEvent) {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || !result || chatting) return;
    const convo = [...messages, { role: "user" as const, content: text }];
    setChatInput("");
    streamReply(convo, inputs, result);
  }

  const info = result ? RISK_INFO[result.risk_level] : null;

  return (
    <main className="mx-auto flex h-screen max-w-5xl flex-col gap-4 overflow-hidden px-4 py-6">
      <header className="text-center">
        <h1 className="text-2xl font-bold">Financial Health Check</h1>
        <p className="mt-1 text-sm text-muted">
          Enter your company&apos;s numbers to see your risk of financial trouble.
        </p>
      </header>

      {error && (
        <section className="rounded-card bg-high-bg p-4 text-center text-sm text-high shadow-card">
          {error}
        </section>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch">
        {/* LEFT — the form */}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-card bg-surface p-6 shadow-card">
          <h2 className="mb-4 text-lg font-semibold">Your numbers</h2>

          <form
            onSubmit={onSubmit}
            className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2"
          >
            {FIELDS.map((f) => (
              <div key={f.key} className="flex h-full flex-col">
                <label htmlFor={f.key} className="text-sm font-semibold">
                  {f.label}
                </label>
                <p className="mt-1 text-xs text-muted">{f.hint}</p>
                {/* mt-auto keeps inputs in a row aligned regardless of hint length */}
                <input
                  id={f.key}
                  name={f.key}
                  type="number"
                  step="any"
                  value={form[f.key]}
                  onChange={(e) => update(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="mt-auto rounded-field bg-field px-4 py-3 text-base shadow-soft outline-none transition focus:shadow-focus"
                />
                {!f.used && (
                  <p className="mt-1 text-xs text-brand">
                    Saved for your records — not scored by the current model yet.
                  </p>
                )}
              </div>
            ))}

            <button
              type="submit"
              disabled={loading}
              className="col-span-full rounded-field bg-brand px-4 py-4 text-base font-semibold text-white shadow-soft transition hover:bg-brand-strong disabled:opacity-60"
            >
              {loading ? "Checking…" : "Check my health"}
            </button>
          </form>
        </section>

        {/* RIGHT — the risk result + chat */}
        <div className="flex min-h-0 flex-col gap-4">
          {!result && (
            <section className="flex flex-1 items-center justify-center rounded-card bg-surface p-6 text-center text-sm text-muted shadow-card">
              Your risk result will appear here after you check your numbers.
            </section>
          )}

          {result && info && (
            <>
              <section className="flex flex-col gap-4 rounded-card bg-surface p-5 shadow-card">
                <div className="flex flex-col gap-1">
                  <span className={`text-3xl font-bold leading-none ${info.color}`}>
                    {info.label}
                  </span>
                  <span className="text-sm text-muted">{info.text}</span>
                </div>

                {/* 3-step meter — the active level is highlighted */}
                <div className="flex gap-2">
                  {RISK_STEPS.map((step, i) => (
                    <div key={step.name} className="flex flex-1 flex-col gap-1">
                      <div
                        className={`h-2 w-full rounded-full ${
                          i === info.order ? step.bar : "bg-field"
                        }`}
                      />
                      <span
                        className={`text-center text-xs ${
                          i === info.order
                            ? `font-semibold ${step.text}`
                            : "text-muted"
                        }`}
                      >
                        {step.name}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Chat with the advisor */}
              <section className="flex min-h-0 flex-1 flex-col rounded-card bg-surface p-5 shadow-card">
                <h3 className="mb-3 text-sm font-bold text-brand">
                  Ask the advisor
                </h3>

                <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
                  {messages.map((m, i) =>
                    m.role === "user" ? (
                      <div
                        key={i}
                        className="ml-auto max-w-[85%] rounded-field bg-brand px-4 py-2 text-sm text-white shadow-soft"
                      >
                        {m.content}
                      </div>
                    ) : (
                      <div
                        key={i}
                        className="mr-auto max-w-[95%] rounded-field bg-field px-4 py-3 text-ink shadow-soft"
                      >
                        {m.content ? (
                          <FormattedText text={m.content} />
                        ) : (
                          <span className="text-sm text-muted">Thinking…</span>
                        )}
                      </div>
                    )
                  )}
                  <div ref={chatEndRef} />
                </div>

                <form onSubmit={onSend} className="mt-4 flex gap-2">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="e.g. How do I lower my risk?"
                    disabled={chatting}
                    className="flex-1 rounded-field bg-field px-4 py-3 text-sm shadow-soft outline-none transition focus:shadow-focus disabled:opacity-60"
                  />
                  <button
                    type="submit"
                    disabled={chatting || !chatInput.trim()}
                    className="rounded-field bg-brand px-5 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-strong disabled:opacity-60"
                  >
                    Send
                  </button>
                </form>
              </section>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
