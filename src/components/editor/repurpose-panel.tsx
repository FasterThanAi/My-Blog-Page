"use client";

import * as React from "react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { useToast } from "@/components/ui/toast";
import { tiptapToPlainText } from "@/lib/tiptap-text";
import { Repeat2, Loader2 } from "lucide-react";

type Format = "twitter_thread" | "linkedin_post" | "newsletter_blurb";

const FORMATS: { id: Format; label: string }[] = [
  { id: "twitter_thread", label: "X / Twitter thread" },
  { id: "linkedin_post", label: "LinkedIn post" },
  { id: "newsletter_blurb", label: "Newsletter blurb" },
];

interface RepurposePanelProps {
  currentContent: unknown;
}

/**
 * One-click AI repurposing: turns the current draft into a Twitter/X
 * thread, LinkedIn post, or newsletter blurb via /api/ai/repurpose.
 */
export function RepurposePanel({ currentContent }: RepurposePanelProps) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [format, setFormat] = React.useState<Format>("twitter_thread");
  const [loading, setLoading] = React.useState(false);
  const [output, setOutput] = React.useState("");

  const handleGenerate = async () => {
    const text = tiptapToPlainText(currentContent);
    if (!text || text.length < 40) {
      toast("Write a bit more content before repurposing.", "error");
      return;
    }

    setLoading(true);
    setOutput("");
    try {
      const response = await fetch("/api/ai/repurpose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, format }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to generate content");
      setOutput(data.output);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to generate content", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} className="flex items-center gap-1.5">
        <Repeat2 className="w-4 h-4" />
        Repurpose
      </Button>

      <Sheet isOpen={open} onClose={() => setOpen(false)} title="Repurpose this post" side="right">
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap gap-2">
            {FORMATS.map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  setFormat(f.id);
                  setOutput("");
                }}
                className={`px-3 py-2 text-12 font-bold uppercase tracking-wider border-2 transition-colors cursor-pointer ${
                  format === f.id
                    ? "bg-accent text-white border-accent"
                    : "border-border text-muted hover:text-text"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <Button onClick={handleGenerate} disabled={loading} className="flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "Generating..." : "Generate"}
          </Button>

          {output && (
            <div className="relative group border-2 border-border bg-bg p-4">
              <pre className="text-13 text-text whitespace-pre-wrap font-sans leading-relaxed">{output}</pre>
              <div className="absolute top-2 right-2">
                <CopyButton text={output} />
              </div>
            </div>
          )}
        </div>
      </Sheet>
    </>
  );
}
