"use client";

import * as React from "react";

interface DrawingBlockProps {
  previewUrl: string;
  aspect: string;
  drawingId: string;
}

export function DrawingBlock({ previewUrl, aspect, drawingId }: DrawingBlockProps) {
  const [svgContent, setSvgContent] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!previewUrl || previewUrl === "null" || previewUrl === "undefined") {
      return;
    }
    let active = true;
    async function loadSvg() {
      try {
        const res = await fetch(previewUrl);
        if (res.ok) {
          const text = await res.text();
          if (active) {
            // Standard sanitation/safety check: remove any script tags inside raw SVG
            const cleanText = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
            setSvgContent(cleanText);
          }
        }
      } catch (err) {
        console.error("Failed to fetch drawing SVG", err);
      }
    }
    loadSvg();
    return () => {
      active = false;
    };
  }, [previewUrl]);

  if (!previewUrl || previewUrl === "null" || previewUrl === "undefined") {
    return null;
  }

  if (!svgContent) {
    return (
      <div 
        className="w-full border border-border/40 rounded-16 animate-pulse bg-surface/50 my-6" 
        style={{ aspectRatio: aspect }} 
      />
    );
  }

  return (
    <div
      className="drawing-block my-6 overflow-hidden flex items-center justify-center bg-surface border border-border/60 rounded-16 cursor-default"
      style={{ aspectRatio: aspect }}
      dangerouslySetInnerHTML={{ __html: svgContent }}
      data-drawing-id={drawingId}
    />
  );
}
