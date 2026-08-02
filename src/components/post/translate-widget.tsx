"use client";

import * as React from "react";
import { Languages, Loader2, X } from "lucide-react";

interface TranslateWidgetProps {
  postId: string;
}

const LOCALES: { code: string; label: string }[] = [
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "ja", label: "Japanese" },
  { code: "hi", label: "Hindi" },
  { code: "pt", label: "Portuguese" },
  { code: "zh", label: "Chinese (Simplified)" },
];

interface TranslationResult {
  title: string;
  paragraphs: string[];
}

/**
 * On-demand post translation. Calls /api/ai/translate (cached per post +
 * locale server-side) and renders the translated title/paragraphs in a
 * plain-text reading card underneath the original article.
 */
export function TranslateWidget({ postId }: TranslateWidgetProps) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [result, setResult] = React.useState<TranslationResult | null>(null);
  const [activeLabel, setActiveLabel] = React.useState("");

  const handleSelect = async (code: string, label: string) => {
    setMenuOpen(false);
    setLoading(true);
    setError("");
    setResult(null);
    setActiveLabel(label);

    try {
      const response = await fetch("/api/ai/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, locale: code }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Translation failed");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Translation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-10 select-none">
      <div className="relative inline-block">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 text-13 font-bold border-2 border-border px-3 py-1.5 text-text hover:border-accent hover:text-accent transition-colors cursor-pointer"
        >
          <Languages className="w-3.5 h-3.5" />
          Translate
        </button>

        {menuOpen && (
          <div className="absolute left-0 top-full mt-1 z-20 bg-surface border-2 border-border min-w-[180px] flex flex-col">
            {LOCALES.map((locale) => (
              <button
                key={locale.code}
                onClick={() => handleSelect(locale.code, locale.label)}
                className="text-left px-3 py-2 text-13 text-text hover:bg-accent hover:text-white transition-colors cursor-pointer"
              >
                {locale.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && (
        <div className="mt-4 flex items-center gap-2 text-13 text-muted">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Translating to {activeLabel}...
        </div>
      )}

      {error && <p className="mt-4 text-13 text-red-600">{error}</p>}

      {result && !loading && (
        <div className="mt-4 border-2 border-border bg-surface p-5 flex flex-col gap-4 animate-in fade-in duration-300">
          <div className="flex items-center justify-between gap-3">
            <span className="label-tag text-accent">Translated · {activeLabel}</span>
            <button
              onClick={() => setResult(null)}
              className="text-muted hover:text-text cursor-pointer"
              aria-label="Close translation"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <h2 className="text-24 font-black text-text leading-tight">{result.title}</h2>
          <div className="flex flex-col gap-4">
            {result.paragraphs.map((p, i) => (
              <p key={i} className="text-15 text-text leading-relaxed">
                {p}
              </p>
            ))}
          </div>
          <p className="text-11 text-muted italic">Machine-translated by AI — may not be perfectly accurate.</p>
        </div>
      )}
    </div>
  );
}
