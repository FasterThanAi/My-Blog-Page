"use client";

import * as React from "react";
import { ArrowDown, X } from "lucide-react";
import { saveReadingProgressAction } from "@/app/actions/reading-history";

interface ReadingProgressProps {
  postId: string;
  initialScrollPercent: number;
}

/**
 * Fixed top progress bar tracking scroll through the article, plus a
 * "resume where you left off" prompt for returning signed-in readers.
 * Progress is throttled client-side and persisted server-side via
 * saveReadingProgressAction (no-ops for signed-out visitors).
 */
export function ReadingProgress({ postId, initialScrollPercent }: ReadingProgressProps) {
  const [percent, setPercent] = React.useState(0);
  const [showResume, setShowResume] = React.useState(initialScrollPercent >= 5 && initialScrollPercent < 95);
  const lastSavedRef = React.useRef(0);
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    const computePercent = () => {
      const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollableHeight <= 0) return 0;
      return Math.min(100, Math.max(0, Math.round((window.scrollY / scrollableHeight) * 100)));
    };

    const scheduleSave = (value: number) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        if (value > lastSavedRef.current) {
          lastSavedRef.current = value;
          saveReadingProgressAction({ postId, scrollPercent: value }).catch(() => {
            // Fail silently — progress tracking is a non-critical enhancement
          });
        }
      }, 2000);
    };

    const handleScroll = () => {
      const value = computePercent();
      setPercent(value);
      scheduleSave(value);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("beforeunload", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("beforeunload", handleScroll);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [postId]);

  const handleResumeClick = () => {
    const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({ top: (initialScrollPercent / 100) * scrollableHeight, behavior: "smooth" });
    setShowResume(false);
  };

  return (
    <>
      {/* Fixed scroll progress indicator */}
      <div className="fixed top-0 left-0 right-0 z-50 h-[3px] bg-border/30 select-none pointer-events-none">
        <div
          className="h-full bg-accent transition-[width] duration-150 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Resume where you left off prompt */}
      {showResume && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <button
            onClick={handleResumeClick}
            className="flex items-center gap-2.5 bg-surface border-2 border-border pl-4 pr-2 py-2.5 text-13 font-bold text-text hover:border-accent transition-colors cursor-pointer shadow-sm"
          >
            <ArrowDown className="w-3.5 h-3.5 text-accent" />
            Resume at {initialScrollPercent}%
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                setShowResume(false);
              }}
              className="p-1 text-muted hover:text-text"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          </button>
        </div>
      )}
    </>
  );
}
