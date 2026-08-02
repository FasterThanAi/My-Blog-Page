"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { getPersonalizedFeedAction } from "@/app/actions/personalized-feed";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { Sparkles, Heart } from "lucide-react";
import { AudioListenButton } from "@/components/audio/audio-listen-button";

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

export function ForYouFeed() {
  const { toast } = useToast();
  const [posts, setPosts] = React.useState<PostItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const handle = requestAnimationFrame(() => {
      setLoading(true);
      getPersonalizedFeedAction()
        .then((data) => setPosts(data as PostItem[]))
        .catch((err) => {
          const message = err instanceof Error ? err.message : "Failed to load your recommendations";
          toast(message, "error");
        })
        .finally(() => setLoading(false));
    });
    return () => cancelAnimationFrame(handle);
  }, [toast]);

  const formatDate = (isoString: string) =>
    new Date(isoString).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

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
        icon={Sparkles}
        title="No picks yet"
        description="Read a few articles to the end and we'll start recommending posts based on what you like. Sign in if you haven't already."
      />
    );
  }

  return (
    <div className="flex flex-col">
      {posts.map((post) => (
        <div
          key={post.id}
          className="py-8 border-b border-border/60 hover:bg-border/10 px-4 rounded-16 transition-all duration-150 flex gap-6 items-start"
        >
          <div className="flex-1 flex flex-col gap-2 min-w-0">
            <div className="flex items-center gap-2 select-none">
              <Avatar src={post.profiles.avatar_url} fallback={post.profiles.username} size="sm" />
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
              className="text-20 font-bold tracking-tight text-text hover:text-accent transition-colors truncate block"
            >
              {post.title || "Untitled"}
            </Link>

            <p className="text-15 text-muted leading-relaxed line-clamp-2">
              {post.excerpt || "No description preview available."}
            </p>

            <div className="flex items-center gap-4 mt-3 text-13 text-muted select-none">
              <span>{post.reading_time_minutes || 1} min read</span>
              <AudioListenButton
                variant="compact"
                post={{
                  id: post.id,
                  title: post.title,
                  excerpt: post.excerpt,
                  coverUrl: post.cover_image_url,
                  authorName: post.profiles.display_name || post.profiles.username,
                }}
              />
              {post.reactions?.[0]?.count > 0 && (
                <span className="flex items-center gap-1.5 text-red-500 font-medium">
                  <Heart className="w-3.5 h-3.5 fill-current" />
                  {post.reactions[0].count}
                </span>
              )}
            </div>
          </div>

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
  );
}
