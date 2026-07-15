"use client";

import * as React from "react";
import { Excalidraw, exportToSvg } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI, ExcalidrawProps } from "@excalidraw/excalidraw/types";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

interface ExcalidrawCanvasProps {
  initialData: unknown; // Excalidraw elements & state JSON
  theme: "light" | "dark";
  onSave: (scene: unknown, svg: SVGSVGElement) => void;
  onCancel: () => void;
}

export function ExcalidrawCanvas({
  initialData,
  theme,
  onSave,
  onCancel,
}: ExcalidrawCanvasProps) {
  const { toast } = useToast();
  const [excalidrawAPI, setExcalidrawAPI] = React.useState<ExcalidrawImperativeAPI | null>(null);
  const [isExporting, setIsExporting] = React.useState(false);

  const handleSave = async () => {
    if (!excalidrawAPI) {
      toast("Editor is still initializing.", "error");
      return;
    }

    const elements = excalidrawAPI.getSceneElements();
    if (!elements || elements.length === 0) {
      toast("Cannot save an empty sketch.", "error");
      return;
    }

    setIsExporting(true);
    try {
      const files = excalidrawAPI.getFiles();
      const appState = excalidrawAPI.getAppState();

      // Export transparent background vector SVG for light/dark modes compatibility
      const svg = await exportToSvg({
        elements,
        appState: {
          ...appState,
          exportBackground: false,
          theme,
        },
        files,
      });

      const scene = {
        elements,
        appState: {
          theme,
          viewBackgroundColor: appState.viewBackgroundColor || "transparent",
        },
        files,
      };

      onSave(scene, svg);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to export sketch";
      toast(message, "error");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col relative bg-surface">
      {/* Excalidraw Canvas Workspace Area */}
      <div className="flex-1 min-h-0 relative select-none">
        <Excalidraw
          excalidrawAPI={(api) => setExcalidrawAPI(api)}
          initialData={(initialData as ExcalidrawProps["initialData"]) || undefined}
          theme={theme}
          UIOptions={{
            canvasActions: {
              toggleTheme: false, // controlled by our app's theme-toggle instead
            },
          }}
        />
      </div>

      {/* Editor Controls Bar */}
      <div className="h-16 shrink-0 border-t border-border px-6 flex items-center justify-end gap-3 bg-surface z-50 select-none">
        <Button variant="ghost" onClick={onCancel} disabled={isExporting}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={isExporting}>
          {isExporting ? "Exporting..." : "Insert Sketch"}
        </Button>
      </div>
    </div>
  );
}
export default ExcalidrawCanvas;
