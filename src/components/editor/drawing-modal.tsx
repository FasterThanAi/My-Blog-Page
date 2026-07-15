"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { useToast } from "@/components/ui/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { saveDrawingAction, getDrawingAction } from "@/app/actions/drawings";
import { X } from "lucide-react";

// Dynamically load the client-only Excalidraw canvas with a loading skeleton fallback
const ExcalidrawCanvas = dynamic(
  () => import("./excalidraw-canvas").then((mod) => mod.ExcalidrawCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex flex-col items-center justify-center bg-surface gap-3 p-8 animate-pulse">
        <div className="w-16 h-16 rounded-16 bg-border/20" />
        <div className="h-4 w-32 bg-border/20 rounded-8" />
      </div>
    ),
  }
);

interface DrawingModalProps {
  isOpen: boolean;
  postId: string;
  drawingId: string | null; // Null if inserting a new sketch, string if editing existing
  onSave: (drawingId: string, previewUrl: string, aspect: string) => void;
  onClose: () => void;
}

export function DrawingModal({
  isOpen,
  postId,
  drawingId,
  onSave,
  onClose,
}: DrawingModalProps) {
  const { toast } = useToast();
  const { resolvedTheme } = useTheme();

  const [loading, setLoading] = React.useState(false);
  const [sceneData, setSceneData] = React.useState<unknown>(null);
  const activeDrawingIdRef = React.useRef<string>("");

  const theme = (resolvedTheme === "dark" ? "dark" : "light") as "light" | "dark";

  // Load drawing scene when re-editing
  React.useEffect(() => {
    if (!isOpen) return;

    const handle = requestAnimationFrame(() => {
      if (drawingId) {
        setLoading(true);
        activeDrawingIdRef.current = drawingId;
        getDrawingAction({ id: drawingId })
          .then((drawing) => {
            setSceneData(drawing.scene);
          })
          .catch((err) => {
            const message = err instanceof Error ? err.message : "Failed to load drawing data";
            toast(message, "error");
            onClose();
          })
          .finally(() => {
            setLoading(false);
          });
      } else {
        // Create new unique drawing UUID
        activeDrawingIdRef.current = crypto.randomUUID();
        setSceneData(null);
        setLoading(false);
      }
    });

    return () => cancelAnimationFrame(handle);
  }, [isOpen, drawingId, onClose, toast]);

  if (!isOpen) return null;

  const handleSaveCanvas = async (sceneJSON: unknown, svgElement: SVGSVGElement) => {
    try {
      const activeDrawingId = activeDrawingIdRef.current;

      // 1. Calculate the aspect ratio metrics of the sketch
      const widthAttr = svgElement.getAttribute("width") || "800";
      const heightAttr = svgElement.getAttribute("height") || "600";
      const width = parseFloat(widthAttr);
      const height = parseFloat(heightAttr);
      const aspect = width && height ? `${width}/${height}` : "16/9";

      // 2. Serialize SVG element to text blob
      const svgString = svgElement.outerHTML;
      const svgBlob = new Blob([svgString], { type: "image/svg+xml" });
      const svgFile = new File([svgBlob], `${activeDrawingId}.svg`, {
        type: "image/svg+xml",
      });

      // 3. Upload SVG file to the RLS-protected storage bucket
      const formData = new FormData();
      formData.append("file", svgFile);
      formData.append("postId", postId);

      const response = await fetch("/api/posts/upload-image", {
        method: "POST",
        body: formData,
      });

      const uploadResult = await response.json();
      if (!response.ok || uploadResult.error) {
        throw new Error(uploadResult.error || "Failed to upload drawing preview.");
      }

      // 4. Save Excalidraw scene details inside drawings table database
      await saveDrawingAction({
        id: activeDrawingId,
        post_id: postId,
        scene: sceneJSON,
        preview_url: uploadResult.url,
      });

      // 5. Notify parent editor workspace of changes
      onSave(activeDrawingId, uploadResult.url, aspect);
      toast("Sketch saved successfully", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save drawing.";
      toast(message, "error");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-6 select-none bg-surface/72 backdrop-blur-[16px] saturate-[1.4] transition-all">
      {/* Container Card with Contract styling */}
      <div className="w-full h-full md:rounded-24 border border-border shadow-2xl flex flex-col overflow-hidden bg-surface relative">
        {/* Top Header Controls */}
        <div className="h-14 shrink-0 px-6 border-b border-border flex items-center justify-between bg-surface/80 backdrop-blur-[8px] z-50">
          <h3 className="text-17 font-semibold text-text">Sketchpad</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-muted hover:text-text hover:bg-border/20 cursor-pointer focus-ring"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Drawing Canvas Area */}
        <div className="flex-1 min-h-0 relative">
          {loading ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-8 animate-pulse">
              <Skeleton className="w-16 h-16 rounded-16" />
              <Skeleton className="h-4 w-32 rounded-8" />
            </div>
          ) : (
            <ExcalidrawCanvas
              initialData={sceneData}
              theme={theme}
              onSave={handleSaveCanvas}
              onCancel={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}
