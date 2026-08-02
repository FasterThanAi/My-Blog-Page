"use client";

import * as React from "react";
import Link from "next/link";
import { MessageCircleQuestion, X, Send, Loader2 } from "lucide-react";

interface Source {
  postId: string;
  title: string;
  slug: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  sources?: Source[];
  error?: boolean;
}

/**
 * Floating "Ask the Archive" chatbot. Public, no sign-in required — calls
 * /api/ai/chat, which does a pgvector semantic search over published posts
 * and answers strictly from the retrieved excerpts, citing sources.
 */
export function AskArchiveWidget() {
  const [open, setOpen] = React.useState(false);
  const [question, setQuestion] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setQuestion("");
    setLoading(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to get an answer");

      setMessages((prev) => [...prev, { role: "assistant", text: data.answer, sources: data.sources || [] }]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setMessages((prev) => [...prev, { role: "assistant", text: message, error: true }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 left-6 z-40 flex items-center gap-2 bg-text text-bg border-2 border-text px-4 py-3 text-13 font-bold shadow-lg hover:opacity-90 transition-opacity cursor-pointer select-none"
        aria-label="Ask the archive"
      >
        <MessageCircleQuestion className="w-4 h-4" />
        Ask the Archive
      </button>

      {open && (
        <div className="fixed bottom-24 left-6 z-40 w-[360px] max-w-[calc(100vw-3rem)] h-[480px] max-h-[70vh] bg-surface border-2 border-border shadow-xl flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center justify-between border-b-2 border-border px-4 py-3">
            <span className="label-tag text-text">Ask the Archive</span>
            <button onClick={() => setOpen(false)} className="text-muted hover:text-text cursor-pointer" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
            {messages.length === 0 && (
              <p className="text-13 text-muted">
                Ask a question and I&apos;ll search every published post for an answer, with sources.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "self-end max-w-[85%]" : "self-start max-w-[90%]"}>
                <div
                  className={`text-13 leading-relaxed px-3 py-2 ${
                    m.role === "user"
                      ? "bg-accent text-white"
                      : m.error
                        ? "bg-red-500/10 text-red-600 border border-red-500/20"
                        : "bg-bg border border-border text-text"
                  }`}
                >
                  {m.text}
                </div>
                {m.sources && m.sources.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {m.sources.map((s) => (
                      <Link
                        key={s.postId}
                        href={`/post/${s.slug}`}
                        className="text-11 font-bold text-accent border border-accent/40 px-2 py-0.5 hover:bg-accent hover:text-white transition-colors"
                      >
                        {s.title}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="self-start flex items-center gap-1.5 text-13 text-muted">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Searching the archive...
              </div>
            )}
          </div>

          <form onSubmit={handleAsk} className="border-t-2 border-border p-3 flex items-center gap-2">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask about anything on this blog..."
              className="flex-1 bg-bg border border-border px-3 py-2 text-13 text-text outline-none focus:border-accent"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="bg-accent text-white p-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              aria-label="Send"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
