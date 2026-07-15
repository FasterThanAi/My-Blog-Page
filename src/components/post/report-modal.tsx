"use client";

import * as React from "react";
import { X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { submitReportAction } from "@/app/actions/reports";

interface ReportModalProps {
  isOpen: boolean;
  postId?: string | null;
  commentId?: string | null;
  onClose: () => void;
}

const REASON_PRESETS = [
  "Spam",
  "Harassment",
  "Inappropriate content",
  "Copyright violation",
  "Other",
];

export function ReportModal({
  isOpen,
  postId,
  commentId,
  onClose,
}: ReportModalProps) {
  const { toast } = useToast();

  const [selectedReason, setSelectedReason] = React.useState(REASON_PRESETS[0]);
  const [detail, setDetail] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  // Close modal on ESC key
  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await submitReportAction({
        postId: postId || null,
        commentId: commentId || null,
        reason: selectedReason,
        detail: detail.trim() || undefined,
      });

      toast("Report submitted successfully", "success");
      onClose();
      // Reset inputs
      setSelectedReason(REASON_PRESETS[0]);
      setDetail("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to submit report";
      toast(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-surface/72 backdrop-blur-[16px] saturate-[1.4] transition-all select-none">
      {/* Modal Container Card with Contract styling */}
      <div className="w-full max-w-md rounded-24 border border-border shadow-2xl overflow-hidden bg-surface flex flex-col p-6 relative">
        {/* Header Controls */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2 text-text">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <h3 className="text-17 font-semibold">Report Content</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-muted hover:text-text hover:bg-border/20 cursor-pointer focus-ring"
            aria-label="Close report modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form area */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <p className="text-13 text-muted leading-relaxed">
            Please select the reason that best describes why this content violates community guidelines.
          </p>

          {/* Reason Presets Radio Grid */}
          <div className="flex flex-col gap-2.5">
            {REASON_PRESETS.map((reason) => {
              const isSelected = selectedReason === reason;
              return (
                <label
                  key={reason}
                  className={`flex items-center justify-between px-4 py-2.5 rounded-12 border cursor-pointer text-13 font-medium transition-colors ${
                    isSelected
                      ? "border-accent bg-accent/5 text-text"
                      : "border-border hover:bg-border/10 text-muted hover:text-text"
                  }`}
                >
                  <span>{reason}</span>
                  <input
                    type="radio"
                    name="report-reason"
                    value={reason}
                    checked={isSelected}
                    onChange={() => setSelectedReason(reason)}
                    className="sr-only"
                  />
                  <div
                    className={`w-4.5 h-4.5 rounded-full border flex items-center justify-center transition-colors ${
                      isSelected ? "border-accent bg-accent" : "border-border bg-surface"
                    }`}
                  >
                    {isSelected && <div className="w-2 h-2 rounded-full bg-white dark:bg-bg" />}
                  </div>
                </label>
              );
            })}
          </div>

          {/* Free text textarea details */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="report-detail" className="text-13 font-medium text-text">
              Additional Details (Optional)
            </label>
            <textarea
              id="report-detail"
              rows={3}
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="Provide context or links to help our moderators understand the issue..."
              maxLength={2000}
              className="w-full text-15 rounded-12 border border-border bg-surface text-text placeholder:text-muted/40 outline-none p-3 focus:border-accent/40 focus:ring-1 focus:ring-accent/40 transition-all leading-normal"
            />
          </div>

          {/* Controls Footer */}
          <div className="flex items-center justify-end gap-3 mt-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={submitting}
              className="h-9 px-4 text-13 rounded-12 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="h-9 px-4 text-13 rounded-12 bg-red-500 hover:bg-red-600 text-white cursor-pointer"
            >
              {submitting ? "Submitting..." : "Submit Report"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
