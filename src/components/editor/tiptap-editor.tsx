"use client";

import * as React from "react";
import { useEditor, EditorContent, Editor, Content } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Table, TableRow, TableHeader, TableCell } from "@tiptap/extension-table";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import { useToast } from "@/components/ui/toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Quote,
  Table as TableIcon,
  Code,
  Minus,
  Palette,
} from "lucide-react";
import { DrawingNode } from "./drawing-node";
import { DrawingModal } from "./drawing-modal";

// Initialize syntax highlighting
const lowlight = createLowlight(common);

interface TiptapEditorProps {
  postId: string;
  initialContent: unknown; // arbitrary Tiptap JSON format
  onChange: (content: unknown) => void;
  onTriggerDrawing?: (drawingId: string | null) => void;
}

export function TiptapEditor({ postId, initialContent, onChange, onTriggerDrawing }: TiptapEditorProps) {
  const { toast } = useToast();
  const [menuPos, setMenuPos] = React.useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [showMenu, setShowMenu] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Excalidraw Sketchpad Modal States
  const [drawingModalOpen, setDrawingModalOpen] = React.useState(false);
  const [editDrawingId, setEditDrawingId] = React.useState<string | null>(null);

  const handleTriggerDrawing = (drawingId: string | null) => {
    setEditDrawingId(drawingId);
    setDrawingModalOpen(true);
  };

  const handleDrawingSave = (drawingId: string, previewUrl: string, aspect: string) => {
    if (!editor) return;

    if (editDrawingId) {
      // Re-editing: find the node by drawingId and update its markup
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === "drawing" && node.attrs.drawingId === editDrawingId) {
          editor.view.dispatch(
            editor.state.tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              previewUrl,
              aspect,
            })
          );
          return false;
        }
      });
    } else {
      // New drawing: insert at the current cursor selection
      editor.chain().focus().setDrawing({ drawingId, previewUrl, aspect }).run();
    }

    setDrawingModalOpen(false);
  };

  // Helper to handle and upload image files
  const uploadImageFile = React.useCallback(
    async (file: File, pos: number, editorInstance: Editor) => {
      // 1. Client-side validations
      const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      if (!allowedTypes.includes(file.type)) {
        toast("Only JPEG, PNG, WEBP, and GIF images are allowed.", "error");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast("Image exceeds 10MB file limit.", "error");
        return;
      }

      const tempId = Math.random().toString(36).substring(2, 9);
      // SVG base64 skeleton image loader fallback
      const skeletonUrl =
        "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='200' viewBox='0 0 300 200'><rect width='300' height='200' fill='%23e5e5e5' rx='8'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='system-ui, sans-serif' font-size='12' fill='%23999999'>Uploading image...</text></svg>";

      // 2. Insert placeholder image in document at the selection point
      editorInstance
        .chain()
        .focus()
        .insertContentAt(pos, {
          type: "image",
          attrs: {
            src: skeletonUrl,
            alt: "Uploading...",
            title: `upload-${tempId}`,
          },
        })
        .run();

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("postId", postId);

        // 3. Upload to Route Handler API
        const response = await fetch("/api/posts/upload-image", {
          method: "POST",
          body: formData,
        });

        const result = await response.json();

        if (!response.ok || result.error) {
          throw new Error(result.error || "Upload failed");
        }

        // 4. Locate placeholder by its unique title attribute and swap it with the public URL
        editorInstance.state.doc.descendants((node, nodePos) => {
          if (node.type.name === "image" && node.attrs.title === `upload-${tempId}`) {
            editorInstance.view.dispatch(
              editorInstance.state.tr.setNodeMarkup(nodePos, undefined, {
                ...node.attrs,
                src: result.url,
                title: null,
                alt: file.name,
              })
            );
            return false;
          }
        });

        toast("Image uploaded successfully", "success");
      } catch (err) {
        // Delete the placeholder on failure
        editorInstance.state.doc.descendants((node, nodePos) => {
          if (node.type.name === "image" && node.attrs.title === `upload-${tempId}`) {
            editorInstance.view.dispatch(
              editorInstance.state.tr.delete(nodePos, nodePos + node.nodeSize)
            );
            return false;
          }
        });
        const message = err instanceof Error ? err.message : "Failed to upload image";
        toast(message, "error");
      }
    },
    [postId, toast]
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false, // disabled in favor of codeBlockLowlight
      }),
      Placeholder.configure({
        placeholder: "Write something or press '/' for commands...",
      }),
      Link.configure({
        openOnClick: false,
      }),
      Image.configure({
        allowBase64: true,
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      CodeBlockLowlight.configure({
        lowlight,
      }),
      DrawingNode,
    ],
    content: initialContent as Content,
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON());
    },
    editorProps: {
      handleDOMEvents: {
        drop: (view, event) => {
          const files = event.dataTransfer?.files;
          if (files && files.length > 0) {
            for (let i = 0; i < files.length; i++) {
              if (files[i].type.startsWith("image/")) {
                event.preventDefault();
                const dropPos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
                uploadImageFile(files[i], dropPos ?? view.state.selection.from, editor as Editor);
                return true;
              }
            }
          }
          return false;
        },
        paste: (view, event) => {
          const items = event.clipboardData?.items;
          if (items) {
            for (let i = 0; i < items.length; i++) {
              if (items[i].type.startsWith("image/")) {
                const file = items[i].getAsFile();
                if (file) {
                  event.preventDefault();
                  uploadImageFile(file, view.state.selection.from, editor as Editor);
                  return true;
                }
              }
            }
          }
          return false;
        },
      },
      handleClickOn: (view, pos, node) => {
        if (node.type.name === "drawing") {
          const drawingId = node.attrs.drawingId;
          if (drawingId) {
            handleTriggerDrawing(drawingId);
            if (onTriggerDrawing) onTriggerDrawing(drawingId);
            return true;
          }
        }
        return false;
      },
      handleKeyDown: (view, event) => {
        if (event.key === "/") {
          // Calculate popup overlay positioning coordinates
          const selection = view.state.selection;
          const coords = view.coordsAtPos(selection.from);
          if (coords) {
            setMenuPos({
              top: coords.bottom + window.scrollY,
              left: coords.left + window.scrollX,
            });
            setShowMenu(true);
          }
        } else if (event.key === "Escape") {
          setShowMenu(false);
        } else if (showMenu && (event.key === " " || event.key === "Backspace" || event.key === "Enter")) {
          // Close slash menu if user continues typing normally
          setShowMenu(false);
        }
        return false;
      },
    },
  });

  const handleMenuCommand = (command: string) => {
    if (!editor) return;

    // Delete the '/' character typed
    const from = editor.state.selection.from;
    editor
      .chain()
      .focus()
      .deleteRange({ from: from - 1, to: from })
      .run();

    setShowMenu(false);

    // Execute selected block command
    switch (command) {
      case "h1":
        editor.chain().focus().toggleHeading({ level: 1 }).run();
        break;
      case "h2":
        editor.chain().focus().toggleHeading({ level: 2 }).run();
        break;
      case "h3":
        editor.chain().focus().toggleHeading({ level: 3 }).run();
        break;
      case "quote":
        editor.chain().focus().toggleBlockquote().run();
        break;
      case "code":
        editor.chain().focus().toggleCodeBlock().run();
        break;
      case "divider":
        editor.chain().focus().setHorizontalRule().run();
        break;
      case "table":
        editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
        break;
      case "image":
        fileInputRef.current?.click();
        break;
      case "draw":
        handleTriggerDrawing(null);
        if (onTriggerDrawing) onTriggerDrawing(null);
        break;
    }
  };

  const handleToolbarImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && editor) {
      uploadImageFile(e.target.files[0], editor.state.selection.from, editor);
    }
  };

  React.useEffect(() => {
    const handleOutsideClick = () => {
      setShowMenu(false);
    };
    if (showMenu) {
      document.addEventListener("click", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("click", handleOutsideClick);
    };
  }, [showMenu]);

  return (
    <div className="relative w-full">
      {/* Invisible file input trigger */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleToolbarImageUpload}
        accept="image/*"
        className="hidden"
      />

      <EditorContent editor={editor} className="min-h-[400px] pb-32" />

      {/* Popover Slash Command Menu Card */}
      {showMenu && (
        <Card
          style={{
            position: "absolute",
            top: menuPos.top - 180, // offset coordinates relative to editor parent
            left: menuPos.left - 24,
          }}
          className="w-56 p-1.5 bg-surface border border-border shadow-lg flex flex-col z-50 rounded-12"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2.5 py-1.5 text-13 font-semibold text-muted border-b border-border mb-1 select-none">
            Basic Blocks
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleMenuCommand("h1")}
            className="w-full justify-start gap-2.5 h-9 text-13"
          >
            <Heading1 className="w-4 h-4 text-muted" />
            Heading 1
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleMenuCommand("h2")}
            className="w-full justify-start gap-2.5 h-9 text-13"
          >
            <Heading2 className="w-4 h-4 text-muted" />
            Heading 2
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleMenuCommand("h3")}
            className="w-full justify-start gap-2.5 h-9 text-13"
          >
            <Heading3 className="w-4 h-4 text-muted" />
            Heading 3
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleMenuCommand("quote")}
            className="w-full justify-start gap-2.5 h-9 text-13"
          >
            <Quote className="w-4 h-4 text-muted" />
            Quote Block
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleMenuCommand("code")}
            className="w-full justify-start gap-2.5 h-9 text-13"
          >
            <Code className="w-4 h-4 text-muted" />
            Code Block
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleMenuCommand("table")}
            className="w-full justify-start gap-2.5 h-9 text-13"
          >
            <TableIcon className="w-4 h-4 text-muted" />
            Table
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleMenuCommand("image")}
            className="w-full justify-start gap-2.5 h-9 text-13"
          >
            <ImageIcon className="w-4 h-4 text-muted" />
            Image File
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleMenuCommand("draw")}
            className="w-full justify-start gap-2.5 h-9 text-13"
          >
            <Palette className="w-4 h-4 text-muted" />
            Sketchpad Drawing
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleMenuCommand("divider")}
            className="w-full justify-start gap-2.5 h-9 text-13 border-t border-border mt-1 pt-1.5"
          >
            <Minus className="w-4 h-4 text-muted" />
            Divider Line
          </Button>
        </Card>
      )}
      {/* Sketchpad Modal */}
      <DrawingModal
        isOpen={drawingModalOpen}
        postId={postId}
        drawingId={editDrawingId}
        onSave={handleDrawingSave}
        onClose={() => setDrawingModalOpen(false)}
      />
    </div>
  );
}
