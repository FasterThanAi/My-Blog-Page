"use client";

import * as React from "react";
import { Bookmark, ImageIcon } from "lucide-react";
import { saveHighlightAction } from "@/app/actions/highlights";
import { useToast } from "@/components/ui/toast";

interface HighlightToolbarProps {
  postId: string;
  postTitle: string;
  authorName: string;
  /** CSS selector for the container selection should be scoped to (the article body). */
  containerSelector: string;
}

interface ToolbarPosition {
  top: number;
  left: number;
}

/**
 * Floating toolbar that appears when a reader selects text inside the
 * article body. Lets them save the excerpt as a highlight, or generate a
 * shareable quote-card image via /api/og/highlight.
 */
export function HighlightToolbar({ postId, postTitle, authorName, containerSelector }: HighlightToolbarProps) {
  const { toast } = useToast();
  const [selectedText, setSelectedText] = React.useState("");
  const [position, setPosition] = React.useState<ToolbarPosition | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      const container = document.querySelector(containerSelector);

      if (!selection || selection.isCollapsed || !container) {
        setPosition(null);
        return;
      }

      const text = selection.toString().trim();
      if (!text || text.length > 500) {
        setPosition(null);
        return;
      }

      const anchorNode = selection.anchorNode;
      if (!anchorNode || !container.contains(anchorNode)) {
        setPosition(null);
        return;
      }

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setPosition(null);
        return;
      }

      setSelectedText(text);
      setPosition({
        top: rect.top + window.scrollY - 46,
        left: rect.left + window.scrollX + rect.width / 2,
      });
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, [containerSelector]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveHighlightAction({ postId, text: selectedText });
      toast("Highlight saved", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save highlight", "error");
    } finally {
      setSaving(false);
      setPosition(null);
    }
  };

  const handleShare = () => {
    const params = new URLSearchParams({
      text: selectedText,
      author: authorName,
      postTitle,
    });
    window.open(`/api/og/highlight?${params.toString()}`, "_blank", "noopener,noreferrer");
    setPosition(null);
  };

  if (!position) return null;

  return (
    <div
      className="fixed z-50 -translate-x-1/2 flex items-center gap-1 bg-text text-bg border-2 border-text px-1.5 py-1.5 shadow-lg select-none animate-in fade-in duration-150"
      style={{ top: position.top, left: position.left }}
    >
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-11 font-bold uppercase tracking-wider hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50"
      >
        <Bookmark className="w-3.5 h-3.5" />
        Save
      </button>
      <div className="w-px h-4 bg-white/20" />
      <button
        onClick={handleShare}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-11 font-bold uppercase tracking-wider hover:bg-white/10 transition-colors cursor-pointer"
      >
        <ImageIcon className="w-3.5 h-3.5" />
        Share as image
      </button>
    </div>
  );
}
