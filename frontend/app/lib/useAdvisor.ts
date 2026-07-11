"use client";

import { useRef, useState } from "react";
import { PredictResult } from "../fields";
import { riskIndex } from "./scoring";
import type { UpdateHistoryInput } from "./history";
import type { ChatMessage } from "../components/AdvisorChat";

/** The prediction context the advisor reasons about. */
export interface AdvisorContext {
  inputs: Record<string, number>;
  result: PredictResult;
}

/**
 * Drives the AI advisor conversation — streaming replies and follow-up
 * question suggestions — independent of where it's rendered. The dashboard
 * uses it live after a prediction; the history page uses it to resume a saved
 * conversation. `persist` (optional) is called with each change so the caller
 * can save messages/suggestions back to its own store.
 */
export function useAdvisor(persist?: (patch: UpdateHistoryInput) => void) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatting, setChatting] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);

  // Kept in refs so the async callbacks always see the current context/persist
  // without being recreated (and without stale closures).
  const ctx = useRef<AdvisorContext | null>(null);
  const persistRef = useRef(persist);
  persistRef.current = persist;

  /** Send the conversation so far to the advisor and stream the reply in. */
  async function streamReply(convo: ChatMessage[]) {
    const c = ctx.current;
    if (!c) return;
    setChatting(true);
    setMessages([...convo, { role: "assistant", content: "" }]);
    let assistantText = "";
    try {
      const res = await fetch("/api/advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputs: c.inputs,
          result: c.result,
          riskIndex: riskIndex(c.result.probability),
          messages: convo,
        }),
      });
      if (!res.ok || !res.body) throw new Error("no stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantText += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: assistantText };
          return copy;
        });
      }
      const fullConvo: ChatMessage[] = [
        ...convo,
        { role: "assistant", content: assistantText },
      ];
      persistRef.current?.({ messages: fullConvo });
      fetchSuggestions(fullConvo);
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

  /** Ask the AI for tappable follow-up questions based on the conversation. */
  async function fetchSuggestions(convo: ChatMessage[]) {
    const c = ctx.current;
    if (!c) return;
    setSuggestLoading(true);
    try {
      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputs: c.inputs,
          result: c.result,
          riskIndex: riskIndex(c.result.probability),
          messages: convo,
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data?.questions)) {
        setSuggestions(data.questions);
        persistRef.current?.({ suggestions: data.questions });
      }
    } catch {
      /* chips simply stay hidden */
    } finally {
      setSuggestLoading(false);
    }
  }

  /** Start a fresh conversation: the advisor's opening assessment + questions. */
  function begin(context: AdvisorContext) {
    ctx.current = context;
    setSuggestions([]);
    setChatInput("");
    streamReply([]);
    fetchSuggestions([]);
  }

  /** Resume a saved conversation without re-generating anything. */
  function resume(
    context: AdvisorContext,
    savedMessages: ChatMessage[],
    savedSuggestions: string[]
  ) {
    ctx.current = context;
    setMessages(savedMessages);
    setSuggestions(savedSuggestions);
    setChatInput("");
  }

  /** Send a message typed by the customer. */
  function sendMessage(text: string) {
    const t = text.trim();
    if (!t || !ctx.current || chatting) return;
    const convo: ChatMessage[] = [...messages, { role: "user", content: t }];
    setChatInput("");
    streamReply(convo);
  }

  function onSend(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(chatInput);
  }

  /**
   * Customer tapped one of the advisor's questions. Drop it into the chat as
   * an advisor message; they answer it in the input — we don't call the model
   * until they reply.
   */
  function pickQuestion(question: string) {
    if (!ctx.current || chatting) return;
    setMessages((prev) => [...prev, { role: "assistant", content: question }]);
    setSuggestions([]);
  }

  return {
    messages,
    suggestions,
    chatInput,
    setChatInput,
    chatting,
    suggestLoading,
    onSend,
    pickQuestion,
    begin,
    resume,
  };
}
