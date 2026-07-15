"use client";

import * as React from "react";
import { Editor } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  Sparkles,
  SpellCheck,
  Languages,
  BookOpen,
  RefreshCw,
  CornerDownLeft,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface AiPanelProps {
  editor: Editor | null;
  onApplyTitle: (title: string) => void;
  onApplyDescription: (description: string) => void;
}

export function AiPanel({ editor, onApplyTitle, onApplyDescription }: AiPanelProps) {
  const { toast } = useToast();
  const [tone, setTone] = React.useState<"concise" | "formal" | "friendly" | "simpler">("concise");
  const [processing, setProcessing] = React.useState<string | null>(null);

  // Metadata generation states
  const [suggestions, setSuggestions] = React.useState<{
    titles: string[];
    description: string;
  } | null>(null);

  // Text diff tags helper parser
  const parseSuggestionToContent = (text: string) => {
    const regex = /\[DEL:(.*?)\]\[INS:(.*?)\]/g;
    let lastIndex = 0;
    const content = [];
    let match;

    while ((match = regex.exec(text)) !== null) {
      const before = text.slice(lastIndex, match.index);
      if (before) {
        content.push({ type: "text", text: before });
      }
      content.push({
        type: "aiSuggestion",
        attrs: {
          original: match[1],
          suggested: match[2],
        },
      });
      lastIndex = regex.lastIndex;
    }

    const after = text.slice(lastIndex);
    if (after) {
      content.push({ type: "text", text: after });
    }

    return content;
  };

  // 3a. Fix grammar & clarity selection or full doc
  const handleFixGrammar = async () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    let text = editor.state.doc.textBetween(from, to, " ");
    const isSelection = !!text;

    if (!isSelection) {
      text = editor.getText();
      const wordCount = text.split(/\s+/).filter(Boolean).length;
      if (wordCount > 2000) {
        toast("No selection made. Full document exceeds the 2000-word limit.", "error");
        return;
      }
      if (!text.trim()) {
        toast("The document is empty.", "error");
        return;
      }
    }

    setProcessing("grammar");
    try {
      const res = await fetch("/api/ai/fix-grammar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to process grammar fix.");
      }

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let resultText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        resultText += decoder.decode(value, { stream: true });
      }

      const parsedContent = parseSuggestionToContent(resultText);

      if (isSelection) {
        editor.chain().focus().insertContentAt({ from, to }, parsedContent).run();
      } else {
        editor.chain().focus().setContent(parsedContent).run();
      }

      toast("Grammar check completed! Approve or reject changes inline.", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Grammar check failed.";
      toast(message, "error");
    } finally {
      setProcessing(null);
    }
  };

  // 3b. Rewrite Selection Tone
  const handleRewriteTone = async () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, " ");

    if (!text) {
      toast("Please select some text to rewrite first.", "error");
      return;
    }

    setProcessing("rewrite");
    try {
      const res = await fetch("/api/ai/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, tone }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to rewrite tone.");
      }

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let resultText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        resultText += decoder.decode(value, { stream: true });
      }

      const parsedContent = parseSuggestionToContent(resultText);
      editor.chain().focus().insertContentAt({ from, to }, parsedContent).run();

      toast(`Rewritten in ${tone} tone! Check suggestion diff inline.`, "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Rewrite failed.";
      toast(message, "error");
    } finally {
      setProcessing(null);
    }
  };

  // Helper: Clear ghostText nodes
  const clearGhostText = (editorInstance: Editor) => {
    editorInstance.state.doc.descendants((node, pos) => {
      if (node.type.name === "ghostText") {
        editorInstance.view.dispatch(
          editorInstance.state.tr.delete(pos, pos + node.nodeSize)
        );
        return false;
      }
    });
  };

  // 3c. Continue writing streams from cursor
  const handleContinueWriting = async () => {
    if (!editor) return;
    const { from } = editor.state.selection;

    // Extract cursor surrounding contexts
    const contextBefore = editor.state.doc.textBetween(Math.max(0, from - 2000), from, " ");
    const contextAfter = editor.state.doc.textBetween(from, Math.min(editor.state.doc.content.size, from + 2000), " ");

    if (!contextBefore.trim()) {
      toast("Please type something first to provide context.", "error");
      return;
    }

    setProcessing("continue");
    clearGhostText(editor);

    try {
      const res = await fetch("/api/ai/continue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contextBefore, contextAfter }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to generate continuation.");
      }

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });

        // Update the ghost text node at selection point
        let ghostPos = -1;
        let nodeSize = 0;
        editor.state.doc.descendants((node, pos) => {
          if (node.type.name === "ghostText") {
            ghostPos = pos;
            nodeSize = node.nodeSize;
            return false;
          }
        });

        const targetPos = ghostPos !== -1 ? ghostPos : editor.state.selection.from;
        const deleteRange = ghostPos !== -1 ? { from: ghostPos, to: ghostPos + nodeSize } : null;

        if (deleteRange) {
          editor.chain()
            .deleteRange(deleteRange)
            .insertContentAt(targetPos, { type: "ghostText", attrs: { text: accumulated } })
            .run();
        } else {
          editor.chain()
            .insertContentAt(targetPos, { type: "ghostText", attrs: { text: accumulated } })
            .run();
        }
      }

      toast("Ghost text generated! Press Tab to Accept, Esc to Dismiss.", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate text continuation.";
      toast(message, "error");
    } finally {
      setProcessing(null);
    }
  };

  // 3d. Title + Meta SEO recommendations generator
  const handleGenerateMetadata = async () => {
    if (!editor) return;
    const text = editor.getText();
    if (!text.trim()) {
      toast("The document is empty.", "error");
      return;
    }

    setSuggestions(null);
    setProcessing("metadata");

    try {
      const res = await fetch("/api/ai/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft: text }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate metadata.");

      setSuggestions(data);
      toast("SEO suggestions ready!", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Metadata suggestions failed.";
      toast(message, "error");
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="w-[320px] shrink-0 border border-border bg-surface rounded-16 p-4 flex flex-col gap-4 self-start sticky top-20 h-[calc(100vh-120px)] overflow-y-auto select-none">
      <div className="flex items-center gap-2 border-b border-border pb-3 mb-1">
        <div className="p-1.5 rounded-8 bg-accent/8 border border-accent/20">
          <Sparkles className="w-4 h-4 text-accent" />
        </div>
        <h3 className="text-15 font-semibold text-text">AI Writing Assistant</h3>
      </div>

      {/* Basic Text Actions */}
      <div className="flex flex-col gap-2">
        <label className="text-11 font-semibold uppercase tracking-wider text-muted px-1">
          Smart Editing
        </label>
        <Button
          variant="secondary"
          className="w-full justify-start gap-2.5 h-10 text-13 border-border hover:bg-border/20 cursor-pointer"
          onClick={handleFixGrammar}
          disabled={!!processing}
        >
          <SpellCheck className="w-4 h-4 text-accent" />
          {processing === "grammar" ? "Checking grammar..." : "Fix Grammar & Clarity"}
        </Button>

        <Button
          variant="secondary"
          className="w-full justify-start gap-2.5 h-10 text-13 border-border hover:bg-border/20 cursor-pointer"
          onClick={handleContinueWriting}
          disabled={!!processing}
        >
          <CornerDownLeft className="w-4 h-4 text-accent" />
          {processing === "continue" ? "Writing text..." : "Continue Writing"}
        </Button>
      </div>

      {/* Rewrite Tone Controls */}
      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <label className="text-11 font-semibold uppercase tracking-wider text-muted px-1">
          Tone Rewriter
        </label>
        <div className="flex flex-wrap gap-1.5 p-1 bg-bg border border-border rounded-12">
          {(["concise", "formal", "friendly", "simpler"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTone(t)}
              className={`flex-1 text-11 py-1 rounded-8 font-medium cursor-pointer transition-all ${
                tone === t
                  ? "bg-surface text-text shadow-sm"
                  : "text-muted hover:text-text"
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <Button
          variant="secondary"
          className="w-full justify-start gap-2.5 h-10 text-13 border-border hover:bg-border/20 cursor-pointer"
          onClick={handleRewriteTone}
          disabled={!!processing}
        >
          <Languages className="w-4 h-4 text-accent" />
          {processing === "rewrite" ? "Rewriting tone..." : `Rewrite selection: ${tone}`}
        </Button>
      </div>

      {/* SEO Metadata generator */}
      <div className="flex flex-col gap-3 border-t border-border pt-4 flex-1">
        <div className="flex items-center justify-between px-1">
          <label className="text-11 font-semibold uppercase tracking-wider text-muted">
            SEO & Metadata
          </label>
          <button
            onClick={handleGenerateMetadata}
            disabled={!!processing}
            className="text-accent text-11 font-medium hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${processing === "metadata" ? "animate-spin" : ""}`} />
            {processing === "metadata" ? "Analyzing..." : "Generate"}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {suggestions ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex flex-col gap-3"
            >
              {/* Titles lists */}
              <div className="flex flex-col gap-1.5">
                <span className="text-11 font-semibold text-muted">Suggested Titles (Click to Apply)</span>
                <div className="flex flex-col gap-1.5">
                  {suggestions.titles.map((titleText, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        onApplyTitle(titleText);
                        toast("Suggested title applied!", "success");
                      }}
                      className="w-full text-left p-2.5 rounded-12 bg-raised border border-border hover:bg-border/10 cursor-pointer text-13 text-text font-medium leading-snug transition-all"
                    >
                      {titleText}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description box */}
              <div className="flex flex-col gap-1.5 pt-2 border-t border-border">
                <span className="text-11 font-semibold text-muted">SEO Description (Click to Apply)</span>
                <button
                  onClick={() => {
                    onApplyDescription(suggestions.description);
                    toast("Suggested description applied!", "success");
                  }}
                  className="w-full text-left p-2.5 rounded-12 bg-raised border border-border hover:bg-border/10 cursor-pointer text-13 text-muted leading-relaxed transition-all"
                >
                  {suggestions.description}
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="h-28 border border-dashed border-border rounded-16 flex flex-col items-center justify-center text-center p-4">
              <BookOpen className="w-6 h-6 text-muted mb-2 opacity-50" />
              <span className="text-13 text-muted">No SEO suggestions yet</span>
              <span className="text-11 text-muted opacity-60">Generate recommendations from draft</span>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
