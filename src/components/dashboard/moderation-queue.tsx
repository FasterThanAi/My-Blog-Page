"use client";

import * as React from "react";
import { fetchReportsQueue, moderateReportAction } from "@/app/actions/dashboard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { AlertTriangle, CheckCircle, Trash2, EyeOff, XCircle } from "lucide-react";

interface Report {
  id: string;
  post_id: string | null;
  comment_id: string | null;
  reason: string;
  status: "open" | "resolved" | "dismissed";
  created_at: string;
  reporter: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  post: {
    id: string;
    title: string;
    content: unknown;
    is_hidden: boolean;
  } | null;
  comment: {
    id: string;
    body: string;
    is_hidden: boolean;
  } | null;
}

export function ModerationQueue() {
  const [activeTab, setActiveTab] = React.useState<"open" | "resolved" | "dismissed">("open");
  const [reports, setReports] = React.useState<Report[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [actioningId, setActioningId] = React.useState<string | null>(null);
  const { toast } = useToast();

  const loadReports = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchReportsQueue({ status: activeTab });
      setReports(data as unknown as Report[]);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load reports", "error");
    } finally {
      setLoading(false);
    }
  }, [activeTab, toast]);

  React.useEffect(() => {
    const handle = requestAnimationFrame(() => {
      loadReports();
    });
    return () => cancelAnimationFrame(handle);
  }, [loadReports]);

  const handleAction = async (reportId: string, action: "hide" | "delete" | "dismiss") => {
    const confirmMessage = 
      action === "hide" ? "Are you sure you want to hide this content? It will be replaced with [removed by moderator]." :
      action === "delete" ? "Are you sure you want to permanently delete this content? This action cannot be undone." :
      "Are you sure you want to dismiss this report?";

    if (!window.confirm(confirmMessage)) return;

    setActioningId(reportId);
    try {
      const res = await moderateReportAction({ reportId, action });
      if (res.success) {
        toast(`Report successfully ${action}ed`, "success");
        loadReports();
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Moderation action failed", "error");
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Tabs */}
      <div className="flex items-center gap-1.5 border-b border-border pb-px">
        {(["open", "resolved", "dismissed"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-13 font-semibold capitalize border-b-2 -mb-px transition-colors cursor-pointer focus-ring ${
              activeTab === tab
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-text"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Reports Queue */}
      {loading ? (
        <div className="flex flex-col gap-4">
          {[1, 2].map((i) => (
            <Card key={i} className="p-5 flex flex-col gap-4 animate-pulse">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-border/20" />
                  <div className="flex flex-col gap-1.5">
                    <div className="w-24 h-4 bg-border/20 rounded" />
                    <div className="w-16 h-3 bg-border/20 rounded" />
                  </div>
                </div>
                <div className="w-20 h-6 bg-border/20 rounded" />
              </div>
              <div className="w-full h-12 bg-border/10 rounded-8" />
            </Card>
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="h-48 border border-dashed border-border/80 rounded-16 bg-surface flex flex-col items-center justify-center gap-2 p-6 text-center select-none">
          <CheckCircle className="w-8 h-8 text-muted stroke-[1.25]" />
          <span className="text-15 font-semibold text-text">Reports queue is empty</span>
          <span className="text-13 text-muted">No content requires moderation under this tab.</span>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {reports.map((report) => {
            const isComment = !!report.comment_id;
            const targetContent = isComment 
              ? report.comment?.body 
              : (typeof report.post?.content === "string" ? report.post.content : report.post?.title);
            
            const isRemoved = isComment ? report.comment?.is_hidden : report.post?.is_hidden;

            return (
              <Card key={report.id} className="p-5 flex flex-col gap-4 border border-border/60 hover:border-border transition-colors bg-surface">
                {/* Header info */}
                <div className="flex justify-between items-start gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-12 bg-red-500/5 text-red-500 border border-red-500/10">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-13 font-semibold text-text">
                        Reported {isComment ? "Comment" : "Post"}
                      </span>
                      <span className="text-11 text-muted">
                        by @{report.reporter?.username || "unknown"} · {new Date(report.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border capitalize ${
                    report.status === "open" ? "bg-red-500/5 border-red-500/10 text-red-500" :
                    report.status === "resolved" ? "bg-green-500/5 border-green-500/10 text-green-600" :
                    "bg-border/20 border-border text-muted"
                  }`}>
                    {report.status}
                  </span>
                </div>

                {/* Reason */}
                <div className="p-3 bg-raised border border-border/40 rounded-12 text-13 text-text">
                  <span className="font-semibold text-muted text-11 block mb-1 uppercase tracking-wider">
                    Reason for Report
                  </span>
                  {report.reason}
                </div>

                {/* Content preview */}
                <div className="p-4.5 bg-raised/40 border border-border/40 rounded-12 flex flex-col gap-2">
                  <span className="font-semibold text-muted text-11 block uppercase tracking-wider">
                    Content Preview
                  </span>
                  {isRemoved ? (
                    <span className="text-13 italic text-muted">[removed by moderator]</span>
                  ) : targetContent ? (
                    <div className="text-13 text-text line-clamp-3 leading-relaxed">
                      {isComment ? (
                        <p>{targetContent}</p>
                      ) : (
                        <div>
                          <p className="font-semibold mb-1">{report.post?.title}</p>
                          <p className="text-muted">{targetContent?.substring?.(0, 150)}...</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-13 italic text-muted">Original content deleted</span>
                  )}
                </div>

                {/* Action buttons (only show if report status is 'open') */}
                {report.status === "open" && (
                  <div className="flex items-center justify-end gap-2.5 border-t border-border/40 pt-4 mt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={actioningId !== null}
                      onClick={() => handleAction(report.id, "dismiss")}
                      className="text-muted hover:text-text"
                    >
                      <XCircle className="w-4 h-4 mr-1.5" />
                      Dismiss
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={actioningId !== null || isRemoved}
                      onClick={() => handleAction(report.id, "hide")}
                      className="hover:border-red-500/20 hover:text-red-500"
                    >
                      <EyeOff className="w-4 h-4 mr-1.5" />
                      Hide Content
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={actioningId !== null}
                      onClick={() => handleAction(report.id, "delete")}
                      className="text-red-600 hover:text-red-700 hover:bg-red-500/10 border-red-500/10"
                    >
                      <Trash2 className="w-4 h-4 mr-1.5" />
                      Delete Permanently
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
