"use client";

import * as React from "react";
import { Sparkles, Loader2 } from "lucide-react";

interface AiSummaryCardProps {
  postId: string;
}

interface SummaryResult {
  tldr: string;
  bullets: string[];
}

/**
 * Reader-facing "Generate summary" card. Calls the public /api/ai/summary
 * route on demand (no sign-in required) and renders a TL;DR + bullet
 * takeaways once generated. Matches the sidebar summary card from the
 * design mockup, adapted to this page's single-column layout.
 */
export function AiSummaryCard({ postId }: AiSummaryCardProps) {
  const [status, setStatus] = React.useState<"idle" | "loading" | "error">("idle");
  const [result, setResult] = React.useState<SummaryResult | null>(null);
  const [errorMessage, setErrorMessage] = React.useState("");

  const handleGenerate = async () => {
    setStatus("loading");
    setErrorMessage("");

    try {
      const response = await fetch("/api/ai/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate summary");
      }

      setResult(data);
      setStatus("idle");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to generate summary");
      setStatus("error");
    }
  };

  return (
    <div className="border-2 border-border bg-surface p-5 mb-10 select-none">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="label-tag text-muted flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-accent" />
          AI Summary
        </span>

        {!result && (
          <button
            onClick={handleGenerate}
            disabled={status === "loading"}
            className="inline-flex items-center gap-1.5 text-13 font-bold border-2 border-border px-3 py-1.5 text-text hover:border-accent hover:text-accent transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === "loading" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {status === "loading" ? "Generating..." : "Generate summary"}
          </button>
        )}
      </div>

      {status === "error" && (
        <p className="text-13 text-red-600 mt-3">{errorMessage}</p>
      )}

      {result && (
        <div className="mt-4 flex flex-col gap-3 animate-in fade-in duration-300">
          <p className="text-15 font-semibold text-text leading-snug">{result.tldr}</p>
          <ul className="flex flex-col gap-1.5">
            {result.bullets.map((bullet, i) => (
              <li key={i} className="text-14 text-muted leading-relaxed flex gap-2">
                <span className="text-accent font-bold">—</span>
                {bullet}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
