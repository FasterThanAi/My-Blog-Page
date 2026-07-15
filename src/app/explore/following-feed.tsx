"use client";

import * as React from "react";
import Link from "next/link";
import { getPublicFollowingPostsAction } from "@/app/actions/public-posts";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { Users, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";

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

interface FollowingFeedProps {
  selectedTag: string | null;
}

export function FollowingFeed({ selectedTag }: FollowingFeedProps) {
  const { toast } = useToast();
  const [posts, setPosts] = React.useState<PostItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(true);
  const observerTargetRef = React.useRef<HTMLDivElement | null>(null);

  // Tracks keyset cursor coordinates
  const lastPostRef = React.useRef<{ publishedAt: string; id: string } | null>(null);

  const fetchFollowingPosts = React.useCallback(
    async (isInitial: boolean) => {
      if (isInitial) {
        setLoading(true);
        lastPostRef.current = null;
      } else {
        setLoadingMore(true);
      }

      try {
        const data = await getPublicFollowingPostsAction({
          cursor: lastPostRef.current,
          tag: selectedTag,
        });

        const list = data as PostItem[];

        if (isInitial) {
          setPosts(list);
        } else {
          // Filter duplicates
          setPosts((prev) => {
            const ids = new Set(prev.map((p) => p.id));
            const unique = list.filter((p) => !ids.has(p.id));
            return [...prev, ...unique];
          });
        }

        if (list.length < 6) {
          setHasMore(false);
        } else {
          const last = list[list.length - 1];
          lastPostRef.current = {
            publishedAt: last.published_at,
            id: last.id,
          };
          setHasMore(true);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load posts";
        toast(message, "error");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [selectedTag, toast]
  );

  // Reload feed whenever tag changes
  React.useEffect(() => {
    const handle = requestAnimationFrame(() => {
      fetchFollowingPosts(true);
    });
    return () => cancelAnimationFrame(handle);
  }, [selectedTag, fetchFollowingPosts]);

  // Set up intersection observer for infinite scrolling
  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          fetchFollowingPosts(false);
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTargetRef.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, loadingMore, loading, fetchFollowingPosts]);

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col">
        {[1, 2, 3].map((n) => (
          <div key={n} className="py-8 border-b border-border flex gap-6 animate-pulse">
            <div className="flex-1 flex flex-col gap-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-1/3 mt-2" />
            </div>
            <Skeleton className="w-32 aspect-[16/10] rounded-12" />
          </div>
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No articles in Following feed"
        description="You are not following any authors with published articles yet, or you are browsing logged out."
        action={
          <Link href="/explore">
            <Button size="sm" onClick={() => window.location.reload()}>
              Discover Authors
            </Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex flex-col">
        {posts.map((post) => (
          <div
            key={post.id}
            className="py-8 border-b border-border/60 hover:bg-border/10 px-4 rounded-16 transition-all duration-150 flex gap-6 items-start"
          >
            {/* Post Metadata Summary */}
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

              <div className="flex items-center gap-4 mt-3 text-13 text-muted select-none">
                <span>{post.reading_time_minutes || 1} min read</span>
                {post.reactions?.[0]?.count > 0 && (
                  <span className="flex items-center gap-1.5 text-red-500 font-medium">
                    <Heart className="w-3.5 h-3.5 fill-current" />
                    {post.reactions[0].count}
                  </span>
                )}
              </div>
            </div>

            {/* Optional cover thumbnail */}
            {post.cover_image_url && (
              <div className="w-28 md:w-36 aspect-[16/10] shrink-0 rounded-12 overflow-hidden border border-border/40 select-none">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={post.cover_image_url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Infinite scroll pagination target anchor */}
      <div ref={observerTargetRef} className="h-10 w-full flex items-center justify-center select-none py-6">
        {loadingMore && (
          <div className="flex gap-2.5">
            <div className="w-2 h-2 bg-accent rounded-full animate-bounce" />
            <div className="w-2 h-2 bg-accent rounded-full animate-bounce [animation-delay:0.2s]" />
            <div className="w-2 h-2 bg-accent rounded-full animate-bounce [animation-delay:0.4s]" />
          </div>
        )}
      </div>
    </div>
  );
}
