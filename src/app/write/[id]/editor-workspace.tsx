"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GlassNav } from "@/components/ui/glass-nav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { TiptapEditor } from "@/components/editor/tiptap-editor";
import { savePostAction, publishPostAction } from "@/app/actions/posts";
import {
  ArrowLeft,
  EyeOff,
  Globe,
  Link2,
  Settings,
  Maximize2,
  Minimize2,
  Camera,
  X,
} from "lucide-react";

interface PostData {
  id: string;
  title: string;
  content: unknown;
  cover_image_url?: string | null;
  excerpt?: string | null;
  status: "draft" | "published" | "archived";
  visibility: "public" | "private" | "unlisted";
  seo_title?: string | null;
  seo_description?: string | null;
}

interface EditorWorkspaceProps {
  post: PostData;
  initialTags: string[];
}

interface TiptapNode {
  type?: string;
  text?: string;
  content?: TiptapNode[];
}

// Extract plain text from Tiptap JSON to auto-suggest excerpt
function extractPlainText(node: TiptapNode): string {
  if (!node) return "";
  if (node.type === "text" && typeof node.text === "string") {
    return node.text;
  }
  if (Array.isArray(node.content)) {
    return node.content.map((child) => extractPlainText(child)).join(" ");
  }
  return "";
}

export function EditorWorkspace({ post, initialTags }: EditorWorkspaceProps) {
  const router = useRouter();
  const { toast } = useToast();

  // Document State
  const [title, setTitle] = React.useState(post.title || "");
  const [content, setContent] = React.useState<unknown>(post.content || {});
  
  // Autosave State
  const [savingState, setSavingState] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSaved, setLastSaved] = React.useState<string>("Saved");

  // Focus Mode
  const [focusMode, setFocusMode] = React.useState(false);

  // Publish Side-sheet State
  const [publishSheetOpen, setPublishSheetOpen] = React.useState(false);
  const [coverImageUrl, setCoverImageUrl] = React.useState(post.cover_image_url || "");
  const [uploadingCover, setUploadingCover] = React.useState(false);
  const [excerpt, setExcerpt] = React.useState(post.excerpt || "");
  const [tags, setTags] = React.useState<string[]>(initialTags);
  const [tagInput, setTagInput] = React.useState("");
  const [visibility, setVisibility] = React.useState<"public" | "private" | "unlisted">(post.visibility);
  const [status, setStatus] = React.useState<"draft" | "published" | "archived">(post.status);
  const [publishing, setPublishing] = React.useState(false);

  // SEO Fields (using defaults if empty)
  const [seoTitle, setSeoTitle] = React.useState(post.seo_title || "");
  const [seoDescription, setSeoDescription] = React.useState(post.seo_description || "");

  // Refs for checking mounts
  const hasMounted = React.useRef(false);

  // Debounced Autosave Trigger
  React.useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }

    setSavingState("saving");
    const timeoutId = setTimeout(async () => {
      try {
        await savePostAction({ id: post.id, title, content });
        setSavingState("saved");
        setLastSaved(`Saved · just now`);
      } catch {
        setSavingState("error");
        toast("Autosave failed. Retrying shortly...", "error");
      }
    }, 3000);

    return () => clearTimeout(timeoutId);
  }, [title, content, post.id, toast]);

  // Update "last saved" timestamp message on interval if status is saved
  React.useEffect(() => {
    if (savingState !== "saved") return;
    const interval = setInterval(() => {
      setLastSaved("Saved · just now");
    }, 60000);
    return () => clearInterval(interval);
  }, [savingState]);

  // Manual Cmd + S or Ctrl + S interceptor
  React.useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        setSavingState("saving");
        try {
          await savePostAction({ id: post.id, title, content });
          setSavingState("saved");
          setLastSaved("Saved · just now");
          toast("Document saved successfully", "success");
        } catch {
          setSavingState("error");
          toast("Save failed.", "error");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [post.id, title, content, toast]);

  // Compute Auto-suggest Excerpt
  const handleOpenPublishSheet = () => {
    if (!excerpt) {
      const text = extractPlainText(content as TiptapNode);
      const suggested = text.substring(0, 160).trim();
      setExcerpt(suggested);
    }
    setPublishSheetOpen(true);
  };

  // Cover Image uploading logic
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    // Client-side validations
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      toast("Only JPEG, PNG, WEBP, and GIF images are allowed.", "error");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast("File size exceeds 10MB limit.", "error");
      return;
    }

    setUploadingCover(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("postId", post.id);

      const res = await fetch("/api/posts/upload-image", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();
      if (!res.ok || result.error) throw new Error(result.error || "Upload failed");

      setCoverImageUrl(result.url);
      toast("Cover image uploaded", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to upload cover image";
      toast(message, "error");
    } finally {
      setUploadingCover(false);
    }
  };

  // Tag Management
  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const val = tagInput.trim().replace(/,/g, "");
      if (val) {
        if (tags.includes(val)) {
          setTagInput("");
          return;
        }
        if (tags.length >= 5) {
          toast("Maximum of 5 tags allowed", "error");
          return;
        }
        setTags([...tags, val]);
        setTagInput("");
      }
    }
  };

  const removeTag = (index: number) => {
    setTags(tags.filter((_, i) => i !== index));
  };

  // Publish / Save Action
  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setPublishing(true);

    try {
      await publishPostAction({
        id: post.id,
        cover_image_url: coverImageUrl || null,
        excerpt: excerpt || null,
        tags,
        visibility,
        status,
        seo_title: seoTitle || null,
        seo_description: seoDescription || null,
      });

      toast(status === "published" ? "Post published successfully!" : "Post updated successfully", "success");
      setPublishSheetOpen(false);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Publish action failed";
      toast(message, "error");
    } finally {
      setPublishing(false);
    }
  };

  const getStatusText = () => {
    switch (savingState) {
      case "saving":
        return "Saving…";
      case "saved":
        return lastSaved;
      case "error":
        return "Saving failed · click save";
      default:
        return "Saved";
    }
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Conditionally hide top Nav if Focus Mode is toggled */}
      {!focusMode && <GlassNav />}

      {/* Editor Sub-Header / Action Bar */}
      <div className="border-b border-border bg-surface select-none sticky top-16 z-30">
        <div className="mx-auto max-w-5xl px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/write">
              <Button variant="ghost" size="sm" className="flex items-center gap-1.5">
                <ArrowLeft className="w-4 h-4 text-muted" />
                Studio
              </Button>
            </Link>
            <span className="text-13 text-muted border-l border-border pl-3 pr-2 py-0.5">
              {getStatusText()}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFocusMode(!focusMode)}
              className="flex items-center gap-1.5"
              aria-label={focusMode ? "Exit focus mode" : "Enter focus mode"}
            >
              {focusMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              {focusMode ? "Exit Focus" : "Focus"}
            </Button>
            <Button size="sm" onClick={handleOpenPublishSheet} className="flex items-center gap-1.5">
              <Settings className="w-4 h-4" />
              Publish
            </Button>
          </div>
        </div>
      </div>

      {/* Editor Content Area */}
      <div className="flex-1 flex justify-center py-12 px-6">
        <div className="w-full max-w-[720px] flex flex-col">
          {/* Title Input field */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled Post"
            className="text-32 md:text-40 font-semibold bg-transparent text-text placeholder:text-muted/40 outline-none border-b border-transparent focus:border-border/30 w-full mb-6 py-2 transition-all leading-tight"
          />

          {/* Tiptap Rich Text Editor */}
          <TiptapEditor
            postId={post.id}
            initialContent={content}
            onChange={setContent}
          />
        </div>
      </div>

      {/* Publish Options Slide Sheet */}
      <Sheet
        isOpen={publishSheetOpen}
        onClose={() => setPublishSheetOpen(false)}
        title="Publish Configurations"
      >
        <form onSubmit={handlePublish} className="flex flex-col gap-6">
          {/* Status Select */}
          <div className="flex flex-col gap-1.5">
            <label className="text-13 font-semibold text-text">Post Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "draft" | "published" | "archived")}
              className="h-[44px] px-4 rounded-12 bg-surface border border-border text-text text-15 outline-none cursor-pointer focus-ring"
            >
              <option value="draft">Draft (Unpublished)</option>
              <option value="published">Published (Live)</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          {/* Visibility Picker */}
          <div className="flex flex-col gap-2">
            <label className="text-13 font-semibold text-text">Visibility Level</label>
            <div className="flex flex-col gap-3">
              <label className="flex items-start gap-3 p-3 rounded-12 border border-border bg-surface cursor-pointer select-none">
                <input
                  type="radio"
                  name="visibility"
                  value="public"
                  checked={visibility === "public"}
                  onChange={() => setVisibility("public")}
                  className="mt-1"
                />
                <div className="flex flex-col gap-0.5">
                  <span className="text-13 font-medium text-text flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5 text-accent" /> Public
                  </span>
                  <span className="text-13 text-muted leading-tight">
                    Anyone can search and read this post on the platform.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-12 border border-border bg-surface cursor-pointer select-none">
                <input
                  type="radio"
                  name="visibility"
                  value="unlisted"
                  checked={visibility === "unlisted"}
                  onChange={() => setVisibility("unlisted")}
                  className="mt-1"
                />
                <div className="flex flex-col gap-0.5">
                  <span className="text-13 font-medium text-text flex items-center gap-1">
                    <Link2 className="w-3.5 h-3.5 text-accent" /> Unlisted
                  </span>
                  <span className="text-13 text-muted leading-tight">
                    Only reachable via direct link. Hidden from feeds and search.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-12 border border-border bg-surface cursor-pointer select-none">
                <input
                  type="radio"
                  name="visibility"
                  value="private"
                  checked={visibility === "private"}
                  onChange={() => setVisibility("private")}
                  className="mt-1"
                />
                <div className="flex flex-col gap-0.5">
                  <span className="text-13 font-medium text-text flex items-center gap-1">
                    <EyeOff className="w-3.5 h-3.5 text-red-500" /> Private
                  </span>
                  <span className="text-13 text-muted leading-tight">
                    Only you can view this post. Securely hidden.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Cover Image Upload */}
          <div className="flex flex-col gap-2">
            <label className="text-13 font-semibold text-text">Cover Image</label>
            <Card className="flex flex-col items-center justify-center p-6 border-dashed text-center min-h-[140px] relative">
              {coverImageUrl ? (
                <div className="relative w-full aspect-video rounded-8 overflow-hidden group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={coverImageUrl} alt="Cover preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setCoverImageUrl("")}
                    className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white hover:bg-black cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center gap-2 cursor-pointer">
                  <Camera className="w-6 h-6 text-muted" />
                  <span className="text-13 text-muted">
                    {uploadingCover ? "Uploading cover image..." : "Upload Cover Image"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleCoverUpload}
                    className="hidden"
                    disabled={uploadingCover}
                  />
                </label>
              )}
            </Card>
          </div>

          {/* Excerpt Section */}
          <div className="flex flex-col gap-1.5">
            <label className="text-13 font-semibold text-text">Excerpt Description</label>
            <Textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="Auto-extracted excerpt summary..."
              maxLength={400}
            />
            <p className="text-13 text-muted leading-tight">
              A short description summary that shows in feeds and social metadata previews.
            </p>
          </div>

          {/* Tag Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-13 font-semibold text-text">Tags (Max 5)</label>
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              placeholder="Add tag and press Enter..."
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {tags.map((tag, idx) => (
                <Badge key={idx} variant="accent" className="flex items-center gap-1">
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(idx)}
                    className="cursor-pointer hover:text-text"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
          {/* SEO Metadata Override Section */}
          <div className="flex flex-col gap-3 border-t border-border pt-4">
            <h4 className="text-13 font-semibold text-text uppercase tracking-wider">SEO Metadata</h4>
            <div className="flex flex-col gap-1.5">
              <label className="text-13 font-medium text-text">SEO Title</label>
              <Input
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                placeholder="Meta title override..."
                maxLength={100}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-13 font-medium text-text">SEO Description</label>
              <Textarea
                value={seoDescription}
                onChange={(e) => setSeoDescription(e.target.value)}
                placeholder="Meta description override..."
                maxLength={200}
              />
            </div>
          </div>

          {/* Submit Action */}
          <Button type="submit" disabled={publishing} className="w-full flex items-center justify-center gap-2 mt-4">
            {publishing ? "Processing..." : status === "published" ? "Publish Changes" : "Save Changes"}
          </Button>
        </form>
      </Sheet>
    </div>
  );
}
