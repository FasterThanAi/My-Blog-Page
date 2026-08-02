"use client";

import * as React from "react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { listPostVersionsAction, restorePostVersionAction } from "@/app/actions/post-versions";
import { tiptapToPlainText } from "@/lib/tiptap-text";
import { wordDiff } from "@/lib/word-diff";
import { History, RotateCcw } from "lucide-react";

interface VersionRow {
  id: string;
  title: string;
  content: unknown;
  label: string;
  created_at: string;
}

interface VersionHistoryProps {
  postId: string;
  currentContent: unknown;
  onRestored: (title: string, content: unknown) => void;
}

export function VersionHistory({ postId, currentContent, onRestored }: VersionHistoryProps) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [versions, setVersions] = React.useState<VersionRow[]>([]);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [restoringId, setRestoringId] = React.useState<string | null>(null);

  const handleOpen = async () => {
    setOpen(true);
    setLoading(true);
    try {
      const data = await listPostVersionsAction({ postId });
      setVersions(data as VersionRow[]);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load version history", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (versionId: string) => {
    setRestoringId(versionId);
    try {
      const result = await restorePostVersionAction({ postId, versionId });
      onRestored(result.title, result.content);
      toast("Version restored", "success");
      setOpen(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to restore version", "error");
    } finally {
      setRestoringId(null);
    }
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  return (
    <>
      <Button variant="ghost" size="sm" onClick={handleOpen} className="flex items-center gap-1.5">
        <History className="w-4 h-4" />
        History
      </Button>

      <Sheet isOpen={open} onClose={() => setOpen(false)} title="Version History" side="right">
        {loading ? (
          <p className="text-13 text-muted">Loading versions...</p>
        ) : versions.length === 0 ? (
          <p className="text-13 text-muted">
            No saved versions yet. A checkpoint is captured automatically every few minutes while you edit.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {versions.map((version) => {
              const isExpanded = expandedId === version.id;
              const currentPlain = tiptapToPlainText(currentContent);
              const versionPlain = tiptapToPlainText(version.content);
              const diff = isExpanded ? wordDiff(currentPlain, versionPlain) : [];

              return (
                <div key={version.id} className="border-2 border-border p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex flex-col">
                      <span className="text-13 font-bold text-text truncate max-w-[220px]">
                        {version.title || "Untitled"}
                      </span>
                      <span className="text-11 text-muted">
                        {version.label} · {formatTime(version.created_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : version.id)}
                        className="text-11 font-bold uppercase tracking-wider text-muted hover:text-text cursor-pointer"
                      >
                        {isExpanded ? "Hide diff" : "Compare"}
                      </button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleRestore(version.id)}
                        disabled={restoringId === version.id}
                        className="h-8 px-2.5 text-11 flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3 h-3" />
                        {restoringId === version.id ? "Restoring..." : "Restore"}
                      </Button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="text-13 leading-relaxed bg-bg border border-border/60 p-3 max-h-64 overflow-y-auto">
                      {diff.map((token, i) => {
                        if (token.type === "same") return <span key={i}>{token.value}</span>;
                        if (token.type === "removed") {
                          return (
                            <span key={i} className="bg-red-500/15 text-red-600 line-through">
                              {token.value}
                            </span>
                          );
                        }
                        return (
                          <span key={i} className="bg-accent/15 text-accent">
                            {token.value}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Sheet>
    </>
  );
}
