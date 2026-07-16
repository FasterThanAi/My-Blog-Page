"use client";

import * as React from "react";
import { useEditor, EditorContent, Editor, Content } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
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
  AlignLeft,
  AlignCenter,
  AlignRight,
  Trash2,
  Plus,
  Grid,
  Sparkles,
  Bold,
  Italic,
  Strikethrough,
  Link as LinkIcon,
} from "lucide-react";
import { TextSelection } from "@tiptap/pm/state";
import { DrawingNode } from "./drawing-node";
import { DrawingModal } from "./drawing-modal";
import { AiSuggestion } from "./ai-suggestion";
import { GhostText } from "./ghost-text";

// Initialize syntax highlighting
const lowlight = createLowlight(common);

interface TiptapEditorProps {
  postId: string;
  initialContent: unknown; // arbitrary Tiptap JSON format
  onChange: (content: unknown) => void;
  onTriggerDrawing?: (drawingId: string | null) => void;
  aiEnabled?: boolean;
  aiSessionOpen?: boolean;
  onToggleAiSession?: () => void;
  editorRef?: (editor: Editor | null) => void;
}

export function TiptapEditor({
  postId,
  initialContent,
  onChange,
  onTriggerDrawing,
  aiEnabled = false,
  aiSessionOpen = false,
  onToggleAiSession,
  editorRef,
}: TiptapEditorProps) {
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
      // Search for any existing empty/placeholder drawing node and update it
      let updated = false;
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === "drawing" && !node.attrs.drawingId) {
          editor.view.dispatch(
            editor.state.tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              drawingId,
              previewUrl,
              aspect,
            })
          );
          updated = true;
          return false;
        }
      });

      if (!updated) {
        // Fallback: new drawing
        editor.chain().focus().setDrawing({ drawingId, previewUrl, aspect }).run();
      }
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

  const acceptGhostText = (editorInstance: Editor) => {
    let text = "";
    editorInstance.state.doc.descendants((node, pos) => {
      if (node.type.name === "ghostText") {
        text = node.attrs.text;
        editorInstance.view.dispatch(
          editorInstance.state.tr
            .delete(pos, pos + node.nodeSize)
            .insertText(text, pos)
        );
        const resolvedPos = editorInstance.state.doc.resolve(pos + text.length);
        editorInstance.view.dispatch(
          editorInstance.state.tr.setSelection(
            new TextSelection(resolvedPos)
          )
        );
        return false;
      }
    });
    return text;
  };

  const clearGhostText = (editorInstance: Editor) => {
    editorInstance.state.doc.descendants((node, pos) => {
      if (node.type.name === "ghostText") {
        editorInstance.view.dispatch(
          editorInstance.state.tr.delete(pos, pos + node.nodeSize)
        );
        return false;
      }
    });
  };

  const [generatingAlt, setGeneratingAlt] = React.useState(false);

  const generateImageAltText = async () => {
    if (!editor) return;
    const src = editor.getAttributes("image").src;
    if (!src) return;
    setGeneratingAlt(true);
    try {
      const res = await fetch("/api/ai/alt-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: src }),
      });
      const data = await res.json();
      if (res.ok && data.altText) {
        const accept = window.confirm(`AI Suggestion for Image Alt Text:\n\n"${data.altText}"\n\nApply this description to the image?`);
        if (accept) {
          editor.chain().focus().updateAttributes("image", { alt: data.altText }).run();
          toast("Alt text applied successfully", "success");
        }
      } else {
        throw new Error(data.error || "Failed to generate alt text");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error generating alt text";
      toast(message, "error");
    } finally {
      setGeneratingAlt(false);
    }
  };

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
      }).extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            width: {
              default: "100%",
              renderHTML: (attributes) => {
                const align = attributes.align || "center";
                let marginStyle = "margin: 0 auto;";
                if (align === "left") marginStyle = "margin-right: auto; margin-left: 0;";
                if (align === "right") marginStyle = "margin-left: auto; margin-right: 0;";
                return {
                  style: `width: ${attributes.width || "100%"}; max-width: 100%; height: auto; display: block; ${marginStyle}`,
                };
              },
            },
            align: {
              default: "center",
              renderHTML: (attributes) => ({
                "data-align": attributes.align || "center",
              }),
            },
          };
        },
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
      AiSuggestion,
      GhostText,
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
      handleDoubleClickOn: (view, pos, node) => {
        if (node.type.name === "drawing") {
          const drawingId = node.attrs.drawingId;
          handleTriggerDrawing(drawingId || null);
          if (onTriggerDrawing) onTriggerDrawing(drawingId || null);
          return true;
        }
        return false;
      },
      handleKeyDown: (view, event) => {
        // 1. Intercept ghostText controls if active
        let hasGhostText = false;
        view.state.doc.descendants((node) => {
          if (node.type.name === "ghostText") {
            hasGhostText = true;
            return false;
          }
        });

        if (hasGhostText) {
          if (event.key === "Tab") {
            event.preventDefault();
            acceptGhostText(editor as Editor);
            return true;
          }
          if (event.key === "Escape") {
            event.preventDefault();
            clearGhostText(editor as Editor);
            return true;
          }
          if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key !== "Shift") {
            clearGhostText(editor as Editor);
          }
        }

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

  React.useEffect(() => {
    if (editorRef) {
      editorRef(editor as Editor);
    }
    return () => {
      if (editorRef) {
        editorRef(null);
      }
    };
  }, [editor, editorRef]);

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
    <div className="relative w-full flex flex-col md:flex-row gap-6">
      {/* Invisible file input trigger */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleToolbarImageUpload}
        accept="image/*"
        className="hidden"
      />

      {/* Floating Side Toolbar - Responsive */}
      {editor && (
        <div className="flex md:flex-col items-center gap-1.5 p-1.5 bg-surface border border-border rounded-16 shadow-[0_4px_20px_rgba(0,0,0,0.02)] mb-4 md:mb-0 md:sticky md:top-20 md:self-start z-10 w-full md:w-fit shrink-0 overflow-x-auto no-scrollbar">
          {aiEnabled && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className={`h-8 w-8 p-0 cursor-pointer shrink-0 transition-colors ${
                  aiSessionOpen
                    ? "text-accent bg-accent/8 border border-accent/20 hover:bg-accent/12"
                    : "text-muted hover:bg-border/20"
                }`}
                onClick={onToggleAiSession}
                title="Toggle AI Side Panel"
              >
                <Sparkles className="w-4 h-4" />
              </Button>
              <div className="w-[1px] h-5 md:w-5 md:h-[1px] bg-border md:my-0.5 shrink-0" />
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-border/20 text-text cursor-pointer shrink-0"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            title="Heading 1"
          >
            <Heading1 className="w-4 h-4 text-muted" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-border/20 text-text cursor-pointer shrink-0"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            title="Heading 2"
          >
            <Heading2 className="w-4 h-4 text-muted" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-border/20 text-text cursor-pointer shrink-0"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            title="Heading 3"
          >
            <Heading3 className="w-4 h-4 text-muted" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-border/20 text-text cursor-pointer shrink-0"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title="Bullet List"
          >
            <Grid className="w-4 h-4 text-muted" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-border/20 text-text cursor-pointer shrink-0"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            title="Blockquote"
          >
            <Quote className="w-4 h-4 text-muted" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-border/20 text-text cursor-pointer shrink-0"
            onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
            title="Insert Table"
          >
            <TableIcon className="w-4 h-4 text-muted" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-border/20 text-text cursor-pointer shrink-0"
            onClick={() => fileInputRef.current?.click()}
            title="Upload Image"
          >
            <ImageIcon className="w-4 h-4 text-muted" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-border/20 text-accent bg-accent/8 border border-accent/20 cursor-pointer shrink-0"
            onClick={() => handleTriggerDrawing(null)}
            title="Insert Sketch Drawing"
          >
            <Palette className="w-4 h-4 text-accent" />
          </Button>
        </div>
      )}

      {/* Editor Body Wrapper */}
      <div className="flex-1 min-w-0 relative">
        <EditorContent editor={editor} className="min-h-[400px] pb-16" />

        {/* Dynamic Bubble Menu for Tables */}
        {editor && (
          <BubbleMenu
            editor={editor}
            shouldShow={({ editor }) => editor.isActive("table")}
          >
            <Card className="flex flex-wrap items-center gap-1.5 p-1.5 bg-surface border border-border shadow-lg rounded-12 select-none max-w-[90vw]">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-13 gap-1 hover:bg-border/20 text-text cursor-pointer"
                onClick={() => editor.chain().focus().addRowBefore().run()}
              >
                <Plus className="w-3.5 h-3.5 text-muted" />
                Row Above
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-13 gap-1 hover:bg-border/20 text-text cursor-pointer"
                onClick={() => editor.chain().focus().addRowAfter().run()}
              >
                <Plus className="w-3.5 h-3.5 text-muted" />
                Row Below
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-13 gap-1 hover:bg-border/20 text-text cursor-pointer"
                onClick={() => editor.chain().focus().addColumnBefore().run()}
              >
                <Plus className="w-3.5 h-3.5 text-muted" />
                Col Left
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-13 gap-1 hover:bg-border/20 text-text cursor-pointer"
                onClick={() => editor.chain().focus().addColumnAfter().run()}
              >
                <Plus className="w-3.5 h-3.5 text-muted" />
                Col Right
              </Button>
              <div className="h-4 w-[1px] bg-border/60 mx-1" />
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-13 gap-1 hover:bg-border/20 text-red-600 cursor-pointer"
                onClick={() => editor.chain().focus().deleteRow().run()}
              >
                Delete Row
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-13 gap-1 hover:bg-border/20 text-red-600 cursor-pointer"
                onClick={() => editor.chain().focus().deleteColumn().run()}
              >
                Delete Col
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-13 gap-1 hover:bg-border/20 text-red-600 hover:bg-red-500/10 cursor-pointer"
                onClick={() => editor.chain().focus().deleteTable().run()}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Table
              </Button>
            </Card>
          </BubbleMenu>
        )}

        {/* Dynamic Bubble Menu for Images */}
        {editor && (
          <BubbleMenu
            editor={editor}
            shouldShow={({ editor }) => editor.isActive("image")}
          >
            <Card className="flex items-center gap-1.5 p-1.5 bg-surface border border-border shadow-lg rounded-12 select-none">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-border/20 text-text cursor-pointer"
                onClick={() => editor.chain().focus().updateAttributes("image", { align: "left" }).run()}
                title="Align Left"
              >
                <AlignLeft className="w-4 h-4 text-muted" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-border/20 text-text cursor-pointer"
                onClick={() => editor.chain().focus().updateAttributes("image", { align: "center" }).run()}
                title="Align Center"
              >
                <AlignCenter className="w-4 h-4 text-muted" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-border/20 text-text cursor-pointer"
                onClick={() => editor.chain().focus().updateAttributes("image", { align: "right" }).run()}
                title="Align Right"
              >
                <AlignRight className="w-4 h-4 text-muted" />
              </Button>
              
              <div className="h-4 w-[1px] bg-border/60 mx-1" />
              
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-13 hover:bg-border/20 text-text cursor-pointer"
                onClick={() => editor.chain().focus().updateAttributes("image", { width: "25%" }).run()}
              >
                25%
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-13 hover:bg-border/20 text-text cursor-pointer"
                onClick={() => editor.chain().focus().updateAttributes("image", { width: "50%" }).run()}
              >
                50%
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-13 hover:bg-border/20 text-text cursor-pointer"
                onClick={() => editor.chain().focus().updateAttributes("image", { width: "100%" }).run()}
              >
                100%
              </Button>

              {aiEnabled && !editor.getAttributes("image").alt && (
                <>
                  <div className="h-4 w-[1px] bg-border/60 mx-1" />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-13 gap-1 hover:bg-border/20 text-accent font-medium cursor-pointer"
                    onClick={generateImageAltText}
                    disabled={generatingAlt}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-accent" />
                    {generatingAlt ? "Generating..." : "Generate Alt"}
                  </Button>
                </>
              )}
            </Card>
          </BubbleMenu>
        )}

        {/* Dynamic Bubble Menu for Drawings */}
        {editor && (
          <BubbleMenu
            editor={editor}
            shouldShow={({ editor }) => editor.isActive("drawing")}
          >
            <Card className="flex items-center gap-1.5 p-1.5 bg-surface border border-border shadow-lg rounded-12 select-none">
              {/* Edit Sketch button */}
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-13 gap-1.5 hover:bg-border/20 text-accent bg-accent/8 border border-accent/20 cursor-pointer font-medium"
                onClick={() => {
                  const drawingId = editor.getAttributes("drawing").drawingId;
                  handleTriggerDrawing(drawingId || null);
                  if (onTriggerDrawing) onTriggerDrawing(drawingId || null);
                }}
              >
                <Palette className="w-3.5 h-3.5 text-accent" />
                Edit Sketch
              </Button>

              <div className="h-4 w-[1px] bg-border/60 mx-1" />

              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-border/20 text-text cursor-pointer"
                onClick={() => editor.chain().focus().updateAttributes("drawing", { align: "left" }).run()}
                title="Align Left"
              >
                <AlignLeft className="w-4 h-4 text-muted" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-border/20 text-text cursor-pointer"
                onClick={() => editor.chain().focus().updateAttributes("drawing", { align: "center" }).run()}
                title="Align Center"
              >
                <AlignCenter className="w-4 h-4 text-muted" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-border/20 text-text cursor-pointer"
                onClick={() => editor.chain().focus().updateAttributes("drawing", { align: "right" }).run()}
                title="Align Right"
              >
                <AlignRight className="w-4 h-4 text-muted" />
              </Button>
              
              <div className="h-4 w-[1px] bg-border/60 mx-1" />
              
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-13 hover:bg-border/20 text-text cursor-pointer"
                onClick={() => editor.chain().focus().updateAttributes("drawing", { width: "25%" }).run()}
              >
                25%
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-13 hover:bg-border/20 text-text cursor-pointer"
                onClick={() => editor.chain().focus().updateAttributes("drawing", { width: "50%" }).run()}
              >
                50%
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-13 hover:bg-border/20 text-text cursor-pointer"
                onClick={() => editor.chain().focus().updateAttributes("drawing", { width: "100%" }).run()}
              >
                100%
              </Button>
            </Card>
          </BubbleMenu>
        )}

        {/* Dynamic Bubble Menu for Text Selection (Bold, Italic, Strikethrough, Link) */}
        {editor && (
          <BubbleMenu
            editor={editor}
            shouldShow={({ editor, state }) => {
              const { selection } = state;
              const isTextSelection = !selection.empty;
              const isNotSpecialNode =
                !editor.isActive("image") &&
                !editor.isActive("drawing") &&
                !editor.isActive("table");
              return isTextSelection && isNotSpecialNode;
            }}
          >
            <Card className="flex items-center gap-1 p-1 bg-surface border border-border shadow-lg rounded-12 select-none">
              <Button
                variant="ghost"
                size="sm"
                className={`h-8 w-8 p-0 cursor-pointer hover:bg-border/20 ${
                  editor.isActive("bold") ? "text-accent bg-accent/8 border border-accent/20" : "text-muted"
                }`}
                onClick={() => editor.chain().focus().toggleBold().run()}
                title="Bold"
              >
                <Bold className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={`h-8 w-8 p-0 cursor-pointer hover:bg-border/20 ${
                  editor.isActive("italic") ? "text-accent bg-accent/8 border border-accent/20" : "text-muted"
                }`}
                onClick={() => editor.chain().focus().toggleItalic().run()}
                title="Italic"
              >
                <Italic className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={`h-8 w-8 p-0 cursor-pointer hover:bg-border/20 ${
                  editor.isActive("strike") ? "text-accent bg-accent/8 border border-accent/20" : "text-muted"
                }`}
                onClick={() => editor.chain().focus().toggleStrike().run()}
                title="Strikethrough"
              >
                <Strikethrough className="w-4 h-4" />
              </Button>

              <div className="h-4 w-[1px] bg-border/60 mx-1" />

              <Button
                variant="ghost"
                size="sm"
                className={`h-8 w-8 p-0 cursor-pointer hover:bg-border/20 ${
                  editor.isActive("link") ? "text-accent bg-accent/8 border border-accent/20" : "text-muted"
                }`}
                onClick={() => {
                  if (editor.isActive("link")) {
                    editor.chain().focus().unsetLink().run();
                  } else {
                    const url = window.prompt("Enter URL:");
                    if (url) {
                      // Normalize URL
                      let href = url.trim();
                      if (href && !/^https?:\/\//i.test(href)) {
                        href = `https://${href}`;
                      }
                      editor.chain().focus().setLink({ href, target: "_blank" }).run();
                    }
                  }
                }}
                title={editor.isActive("link") ? "Remove Link" : "Add Link"}
              >
                <LinkIcon className="w-4 h-4" />
              </Button>
            </Card>
          </BubbleMenu>
        )}

        {/* Sketchpad info / quick tip banner */}
        <div className="border border-dashed border-border/80 rounded-16 p-4 bg-surface/50 text-13 text-muted flex items-start gap-3 mt-6 select-none">
          <Palette className="w-5 h-5 text-accent shrink-0 mt-0.5" />
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-text">How to draw sketches?</span>
            <span>
              Click the <strong className="text-accent">Palette</strong> button in the left sidebar to open the Excalidraw Sketchpad.
              Once drawing is saved, click on the sketch preview block in the editor to select it, show sizing/alignment options, or click <strong className="text-accent">&#39;Edit Sketch&#39;</strong> to modify it. You can also double click the sketch to edit it instantly.
            </span>
          </div>
        </div>
      </div>

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
