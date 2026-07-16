"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { GlassNav } from "@/components/ui/glass-nav";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { toggleBookmarkAction } from "@/app/actions/public-posts";
import { Bookmark, Heart, Trash2, ArrowRight } from "lucide-react";

interface PostItem {
  id: string;
  title: string;
  excerpt?: string | null;
  cover_image_url?: string | null;
  published_at: string;
  reading_time_minutes?: number | null;
  reactions: { count: number }[];
  profiles: {
    username: string;
    display_name?: string | null;
    avatar_url?: string | null;
  };
}

export default function BookmarksPage() {
  const supabase = createClient();
  const { toast } = useToast();

  const [posts, setPosts] = React.useState<PostItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isAuthenticated, setIsAuthenticated] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    async function initPage() {
      // 1. Verify User authentication context
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }

      setIsAuthenticated(true);

      // 2. Fetch bookmarks from Supabase joining posts, profiles and likes counts
      try {
        const { data, error } = await supabase
          .from("bookmarks")
          .select("post_id, posts(*, profiles!author_id(*), reactions(count))")
          .eq("user_id", user.id);

        if (error) throw new Error(error.message);

        const list = (data || [])
          .map((b) => b.posts)
          .filter(Boolean) as unknown as PostItem[];

        setPosts(list);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load bookmarks";
        toast(message, "error");
      } finally {
        setLoading(false);
      }
    }

    initPage();
  }, [supabase, toast]);

  const handleRemoveBookmark = async (postId: string, title: string) => {
    // 1. Optimistic removal from posts list
    const originalPosts = [...posts];
    setPosts((prev) => prev.filter((p) => p.id !== postId));

    try {
      await toggleBookmarkAction({ postId });
      toast(`Removed bookmark: ${title || "Untitled"}`, "success");
    } catch (err) {
      // 2. Revert on failure
      setPosts(originalPosts);
      const message = err instanceof Error ? err.message : "Failed to remove bookmark";
      toast(message, "error");
    }
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex flex-col">
        <GlassNav />
        <main className="mx-auto max-w-4xl px-6 py-12 flex-1 w-full flex flex-col gap-6 select-none">
          <Skeleton className="h-9 w-48 rounded-8" />
          <div className="flex flex-col gap-4 mt-6">
            {[1, 2].map((n) => (
              <div key={n} className="py-8 border-b border-border flex gap-6">
                <div className="flex-1 flex flex-col gap-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-5/6" />
                </div>
                <Skeleton className="w-32 aspect-[16/10] rounded-12" />
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  // Signed out user state prompts login
  if (isAuthenticated === false) {
    return (
      <div className="min-h-screen bg-bg flex flex-col">
        <GlassNav />
        <main className="mx-auto max-w-4xl px-6 py-12 flex-1 w-full flex flex-col justify-center items-center select-none">
          <EmptyState
            icon={Bookmark}
            title="Access bookmarks"
            description="You must be signed in to view and manage your library of bookmarked posts."
            action={
              <Link href="/auth/sign-in">
                <Button size="sm">Sign In</Button>
              </Link>
            }
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col selection:bg-accent/20">
      <GlassNav />

      <main className="mx-auto max-w-4xl px-6 py-12 flex-1 w-full flex flex-col gap-6">
        <div className="flex flex-col gap-1.5 select-none">
          <h1 className="text-32 font-semibold tracking-tight text-text">My Bookmarks</h1>
          <p className="text-15 text-muted">A private space for articles and tutorials you&apos;ve saved to read later.</p>
        </div>

        {posts.length > 0 ? (
          <div className="flex flex-col mt-4">
            {posts.map((post) => (
              <div
                key={post.id}
                className="py-8 border-b border-border/60 hover:bg-border/10 px-4 rounded-16 transition-all duration-150 flex gap-6 items-start group"
              >
                {/* Bookmarked Post Metadata Summary */}
                <div className="flex-1 flex flex-col gap-2 min-w-0">
                  <div className="flex items-center gap-2 select-none">
                    <Avatar
                      src={post.profiles.avatar_url}
                      fallback={post.profiles.username}
                      size="sm"
                    />
                    <Link
                      href={`/profile/${post.profiles.username}`}
                      className="text-13 font-medium text-text hover:text-accent transition-colors"
                    >
                      {post.profiles.display_name || post.profiles.username}
                    </Link>
                    <span className="text-13 text-muted">·</span>
                    <span className="text-13 text-muted">{formatDate(post.published_at)}</span>
                  </div>

                  <Link
                    href={`/post/${post.id}`}
                    className="text-20 font-semibold tracking-tight text-text hover:text-accent transition-colors truncate block"
                  >
                    {post.title || "Untitled"}
                  </Link>

                  <p className="text-15 text-muted leading-relaxed line-clamp-2">
                    {post.excerpt || "No description preview available."}
                  </p>

                  <div className="flex items-center justify-between mt-3 select-none">
                    <div className="flex items-center gap-4 text-13 text-muted">
                      <span>{post.reading_time_minutes || 1} min read</span>
                      {post.reactions?.[0]?.count > 0 && (
                        <span className="flex items-center gap-1.5 text-red-500 font-medium">
                          <Heart className="w-3.5 h-3.5 fill-current" />
                          {post.reactions[0].count}
                        </span>
                      )}
                    </div>

                    {/* Quick Remove Action Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveBookmark(post.id, post.title)}
                      className="h-8 gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-500/10 rounded-8 px-2.5 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-150 cursor-pointer focus-ring"
                      aria-label="Remove bookmark"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="text-12 font-medium">Remove</span>
                    </Button>
                  </div>
                </div>

                {/* Optional cover thumbnail */}
                {post.cover_image_url && (
                  <div className="w-28 md:w-36 aspect-[16/10] shrink-0 rounded-12 overflow-hidden border border-border/40 select-none relative">
                    <Image
                      src={post.cover_image_url}
                      alt={post.title || "Post thumbnail"}
                      fill
                      sizes="(max-width: 768px) 112px, 144px"
                      className="object-cover"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Bookmark}
            title="No bookmarks saved"
            description="When reading articles, click the bookmark icon to save links for reference here."
            action={
              <Link href="/explore">
                <Button size="sm" className="flex items-center gap-2">
                  Browse Feed
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            }
          />
        )}
      </main>
    </div>
  );
}
