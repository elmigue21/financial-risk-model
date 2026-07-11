"use client";

import { useEffect, useRef } from "react";

export type ChatMessage = { role: "user" | "assistant"; content: string };

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

export function AdvisorChat({
  messages,
  chatInput,
  setChatInput,
  onSend,
  onPick,
  suggestions,
  suggestLoading,
  chatting,
}: {
  messages: ChatMessage[];
  chatInput: string;
  setChatInput: (v: string) => void;
  onSend: (e: React.FormEvent) => void;
  onPick: (text: string) => void;
  suggestions: string[];
  suggestLoading: boolean;
  chatting: boolean;
}) {
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /** Advisor's question tapped → show it, then focus the box to answer. */
  function pick(question: string) {
    onPick(question);
    inputRef.current?.focus();
  }

  return (
    <section className="flex min-h-[320px] flex-col rounded-card bg-surface p-5 shadow-card">
      <h3 className="mb-3 text-sm font-bold text-brand">AI financial advisor</h3>

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

      {/* The advisor's questions — tap one to answer it in the box below */}
      {!chatting && (suggestLoading || suggestions.length > 0) && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold text-muted">
            The advisor would like to know — tap to answer
          </p>
          {suggestLoading && suggestions.length === 0 ? (
            <p className="text-xs italic text-muted">Thinking of good questions…</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {suggestions.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => pick(q)}
                  className="rounded-full bg-field px-3 py-1.5 text-left text-xs font-medium text-brand shadow-soft transition hover:shadow-focus"
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <form onSubmit={onSend} className="mt-3 flex gap-2">
        <input
          ref={inputRef}
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          placeholder="Type your answer or a question…"
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
  );
}
