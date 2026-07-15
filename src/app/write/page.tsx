"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { GlassNav } from "@/components/ui/glass-nav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { createDraftAction, deletePostAction } from "@/app/actions/posts";
import {
  Plus,
  Edit2,
  Trash2,
  Globe,
  EyeOff,
  Link2,
  FileText,
  BookOpen,
  Lock,
} from "lucide-react";

interface PostItem {
  id: string;
  title: string;
  updated_at: string;
  status: "draft" | "published" | "archived";
  visibility: "public" | "private" | "unlisted";
}

export default function StudioPage() {
  const supabase = createClient();
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = React.useState(true);
  const [posts, setPosts] = React.useState<PostItem[]>([]);
  const [creating, setCreating] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState("drafts");

  // Deletion Modal state
  const [postToDelete, setPostToDelete] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const fetchPosts = React.useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth/sign-in?returnTo=/write");
        return;
      }

      const { data, error } = await supabase
        .from("posts")
        .select("id, title, updated_at, status, visibility")
        .eq("author_id", user.id)
        .order("updated_at", { ascending: false });

      if (!error && data) {
        setPosts(data as PostItem[]);
      }
    } catch {
      toast("Error loading posts.", "error");
    } finally {
      setLoading(false);
    }
  }, [supabase, router, toast]);

  React.useEffect(() => {
    const handle = requestAnimationFrame(() => {
      fetchPosts();
    });
    return () => cancelAnimationFrame(handle);
  }, [fetchPosts]);

  const handleCreatePost = async () => {
    setCreating(true);
    try {
      const draftId = await createDraftAction();
      toast("Draft created successfully", "success");
      router.push(`/write/${draftId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create new draft";
      toast(message, "error");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!postToDelete) return;
    setDeleting(true);
    try {
      await deletePostAction({ id: postToDelete });
      toast("Post deleted successfully", "success");
      setPosts((prev) => prev.filter((p) => p.id !== postToDelete));
      setPostToDelete(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete post";
      toast(message, "error");
    } finally {
      setDeleting(false);
    }
  };

  // Classify posts by active categories
  const drafts = posts.filter((p) => p.status === "draft");
  const published = posts.filter((p) => p.status === "published" && p.visibility !== "private");
  const privatePosts = posts.filter((p) => p.visibility === "private" || p.status === "archived");

  const studioTabs = [
    { id: "drafts", label: `Drafts (${drafts.length})` },
    { id: "published", label: `Published (${published.length})` },
    { id: "private", label: `Private (${privatePosts.length})` },
  ];

  const getVisibilityIcon = (visibility: string) => {
    switch (visibility) {
      case "public":
        return <Globe className="w-3.5 h-3.5 text-muted" />;
      case "unlisted":
        return <Link2 className="w-3.5 h-3.5 text-muted" />;
      case "private":
        return <EyeOff className="w-3.5 h-3.5 text-red-500" />;
      default:
        return null;
    }
  };

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const renderList = (items: PostItem[], type: string) => {
    if (items.length === 0) {
      if (type === "drafts") {
        return (
          <EmptyState
            icon={FileText}
            title="No drafts found"
            description="Start typing your next masterpiece. Drafts will compile here until published."
            action={
              <Button size="sm" onClick={handleCreatePost} disabled={creating}>
                Create Draft
              </Button>
            }
          />
        );
      }
      if (type === "published") {
        return (
          <EmptyState
            icon={BookOpen}
            title="No published posts"
            description="Share your stories with the world. Open a draft and configure visibility details to publish."
          />
        );
      }
      return (
        <EmptyState
          icon={Lock}
          title="No private posts"
          description="Private and archived entries will appear securely in this section."
        />
      );
    }

    return (
      <div className="flex flex-col gap-3">
        {items.map((post) => (
          <Card key={post.id} className="flex items-center justify-between p-5 hover:border-accent/20 transition-colors">
            <div className="flex flex-col gap-1 min-w-0 pr-4">
              <div className="flex items-center gap-2">
                <Link
                  href={`/write/${post.id}`}
                  className="text-17 font-semibold text-text hover:text-accent transition-colors truncate block"
                >
                  {post.title || "Untitled"}
                </Link>
                {getVisibilityIcon(post.visibility)}
              </div>
              <p className="text-13 text-muted">
                Updated {formatDate(post.updated_at)}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={post.status === "published" ? "success" : "secondary"}>
                {post.status}
              </Badge>
              <Link href={`/write/${post.id}`}>
                <Button variant="ghost" size="sm" className="w-[36px] h-[36px] p-0" aria-label="Edit post">
                  <Edit2 className="w-4 h-4" />
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPostToDelete(post.id)}
                className="w-[36px] h-[36px] p-0 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                aria-label="Delete post"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-bg">
      <GlassNav />

      <main className="mx-auto max-w-5xl px-6 py-12 flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-32 font-semibold tracking-tight text-text">Writing Studio</h1>
            <p className="text-15 text-muted">Create, edit, and organize your publication drafts.</p>
          </div>

          <Button onClick={handleCreatePost} disabled={creating} className="flex items-center gap-1.5">
            <Plus className="w-4.5 h-4.5" />
            New Post
          </Button>
        </div>

        <Tabs tabs={studioTabs} activeTab={activeTab} onChange={(id) => setActiveTab(id)} className="mb-4" />

        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((n) => (
              <Card key={n} className="flex items-center justify-between p-5 animate-pulse">
                <div className="flex flex-col gap-2 flex-1">
                  <Skeleton className="h-5 w-1/3" />
                  <Skeleton className="h-4 w-1/4" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="w-16 h-8 rounded-full" />
                  <Skeleton className="w-9 h-9 rounded-12" />
                  <Skeleton className="w-9 h-9 rounded-12" />
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div>
            {activeTab === "drafts" && renderList(drafts, "drafts")}
            {activeTab === "published" && renderList(published, "published")}
            {activeTab === "private" && renderList(privatePosts, "private")}
          </div>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={postToDelete !== null}
        onClose={() => setPostToDelete(null)}
        title="Delete Post"
      >
        <p className="text-15 text-muted mb-6">
          Are you sure you want to permanently delete this post? This action is irreversible and all associated data, including drafts and uploads, will be erased.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setPostToDelete(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDeleteConfirm} disabled={deleting}>
            {deleting ? "Deleting..." : "Permanently Delete"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
