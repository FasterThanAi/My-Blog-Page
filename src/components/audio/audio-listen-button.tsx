"use client";

import * as React from "react";
import { useAudioReader, ArticleContent } from "@/context/audio-reader-context";
import { Play, Pause, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AudioListenButtonProps {
  post: ArticleContent;
  variant?: "default" | "compact";
  showText?: boolean;
  className?: string;
}

export function AudioListenButton({
  post,
  variant = "default",
  showText = true,
  className = "",
}: AudioListenButtonProps) {
  const { activePost, isPlaying, playPost, pause, resume } = useAudioReader();

  const isThisPostActive = activePost?.id === post.id;
  const isThisPostPlaying = isThisPostActive && isPlaying;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isThisPostActive) {
      if (isPlaying) {
        pause();
      } else {
        resume();
      }
    } else {
      playPost(post);
    }
  };

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-12 font-medium transition-all ${
          isThisPostPlaying
            ? "bg-accent/15 text-accent border border-accent/30 shadow-sm"
            : "bg-secondary/60 text-muted hover:text-text hover:bg-secondary border border-border/40"
        } ${className}`}
        title={isThisPostPlaying ? "Pause Article Readout" : "Listen to Article (Audio Reader)"}
      >
        {isThisPostPlaying ? (
          <>
            <span className="flex items-end gap-0.5 h-3 shrink-0">
              <span className="w-0.5 bg-accent h-full animate-bounce" />
              <span className="w-0.5 bg-accent h-2/3 animate-bounce [animation-delay:0.15s]" />
              <span className="w-0.5 bg-accent h-4/5 animate-bounce [animation-delay:0.3s]" />
            </span>
            {showText && <span>Playing</span>}
          </>
        ) : (
          <>
            <Volume2 className="w-3.5 h-3.5 text-accent shrink-0" />
            {showText && <span>Listen</span>}
          </>
        )}
      </button>
    );
  }

  return (
    <Button
      variant={isThisPostPlaying ? "primary" : "secondary"}
      size="sm"
      onClick={handleClick}
      className={`rounded-full transition-all gap-2 ${
        isThisPostPlaying
          ? "bg-accent text-white shadow-md"
          : "border-border/70 hover:border-accent/50 text-text"
      } ${className}`}
      title={isThisPostPlaying ? "Pause Audio Reader" : "Listen to Article"}
    >
      {isThisPostPlaying ? (
        <>
          <Pause className="w-4 h-4 fill-current shrink-0" />
          {showText && <span>Pause Audio</span>}
        </>
      ) : (
        <>
          <Volume2 className="w-4 h-4 text-accent shrink-0" />
          {showText && <span>Listen to Article</span>}
        </>
      )}
    </Button>
  );
}
