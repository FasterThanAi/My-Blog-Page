"use client";

import * as React from "react";
import Link from "next/link";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import {
  toggleFollowAction,
  toggleReactionAction,
  toggleBookmarkAction,
} from "@/app/actions/public-posts";
import {
  Heart,
  Bookmark,
  Share2,
  Calendar,
  Clock,
  Eye,
} from "lucide-react";

interface PostActionsProps {
  postId: string;
  authorId: string;
  authorUsername: string;
  authorDisplayName?: string | null;
  authorAvatarUrl?: string | null;
  authorBio?: string | null;
  publishedAt: string;
  readingTime: number;
  views: number;
  initialLikesCount: number;
  initialLiked: boolean;
  initialBookmarked: boolean;
  initialFollowed: boolean;
  isOwnPost: boolean;
}

export function PostActions({
  postId,
  authorId,
  authorUsername,
  authorDisplayName,
  authorAvatarUrl,
  authorBio,
  publishedAt,
  readingTime,
  views,
  initialLikesCount,
  initialLiked,
  initialBookmarked,
  initialFollowed,
  isOwnPost,
}: PostActionsProps) {
  const { toast } = useToast();

  const [liked, setLiked] = React.useState(initialLiked);
  const [likesCount, setLikesCount] = React.useState(initialLikesCount);
  const [bookmarked, setBookmarked] = React.useState(initialBookmarked);
  const [followed, setFollowed] = React.useState(initialFollowed);
  const [followLoading, setFollowLoading] = React.useState(false);

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  // Optimistic Likes Reaction Toggler
  const handleLikeToggle = async () => {
    // 1. Optimistic Update UI
    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikesCount((prev) => (nextLiked ? prev + 1 : Math.max(0, prev - 1)));

    try {
      await toggleReactionAction({ postId, type: "like" });
    } catch (err) {
      // 2. Revert on error
      setLiked(liked);
      setLikesCount(likesCount);
      const message = err instanceof Error ? err.message : "Failed to register reaction";
      toast(message, "error");
    }
  };

  // Optimistic Bookmarks Toggler
  const handleBookmarkToggle = async () => {
    const nextBookmarked = !bookmarked;
    setBookmarked(nextBookmarked);

    try {
      await toggleBookmarkAction({ postId });
      toast(nextBookmarked ? "Post bookmarked" : "Bookmark removed", "success");
    } catch (err) {
      setBookmarked(bookmarked);
      const message = err instanceof Error ? err.message : "Failed to update bookmark";
      toast(message, "error");
    }
  };

  // Follow Connection Toggler
  const handleFollowToggle = async () => {
    if (isOwnPost) return;
    setFollowLoading(true);

    try {
      const result = await toggleFollowAction({ followingId: authorId });
      setFollowed(result.followed);
      toast(
        result.followed ? `Now following ${authorUsername}` : `Unfollowed ${authorUsername}`,
        "success"
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to follow author";
      toast(message, "error");
    } finally {
      setFollowLoading(false);
    }
  };

  // Copy URL Sharing helper
  const handleShare = async () => {
    try {
      const url = window.location.href;
      await navigator.clipboard.writeText(url);
      toast("Post link copied to clipboard", "success");
    } catch {
      toast("Failed to copy link", "error");
    }
  };

  return (
    <div className="flex flex-col gap-8 w-full border-t border-border/60 mt-12 pt-8 select-none">
      {/* Article Stats & Interactive Icons Controls Row */}
      <div className="flex items-center justify-between py-2 border-b border-border/40 pb-6">
        <div className="flex items-center gap-6 text-13 text-muted">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4" />
            {formatDate(publishedAt)}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            {readingTime} min read
          </span>
          <span className="flex items-center gap-1.5">
            <Eye className="w-4 h-4" />
            {views} views
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Reaction Button (Optimistic) */}
          <button
            type="button"
            onClick={handleLikeToggle}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all cursor-pointer text-13 font-medium focus-ring ${
              liked
                ? "bg-red-500/10 border-red-500/30 text-red-500 hover:bg-red-500/15"
                : "border-border bg-surface text-muted hover:text-text hover:bg-border/10"
            }`}
            aria-label="React to post"
          >
            <Heart className={`w-4 h-4 ${liked ? "fill-current" : ""}`} />
            <span>{likesCount}</span>
          </button>

          {/* Bookmark Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBookmarkToggle}
            className={`w-9 h-9 p-0 rounded-full cursor-pointer focus-ring ${
              bookmarked ? "text-accent" : "text-muted hover:text-text"
            }`}
            aria-label="Bookmark post"
          >
            <Bookmark className={`w-4 h-4 ${bookmarked ? "fill-current" : ""}`} />
          </Button>

          {/* Share Link Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleShare}
            className="w-9 h-9 p-0 rounded-full text-muted hover:text-text cursor-pointer focus-ring"
            aria-label="Share post"
          >
            <Share2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Author Card Block */}
      <div className="p-6 rounded-16 border border-border bg-surface flex flex-col md:flex-row items-start md:items-center justify-between gap-4 select-none">
        <div className="flex items-start gap-4">
          <Avatar
            src={authorAvatarUrl}
            fallback={authorUsername}
            size="lg"
            className="w-14 h-14"
          />
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Link
                href={`/profile/${authorUsername}`}
                className="text-17 font-semibold text-text hover:text-accent transition-colors"
              >
                {authorDisplayName || authorUsername}
              </Link>
              <span className="text-13 text-muted">@{authorUsername}</span>
            </div>
            <p className="text-13 text-muted max-w-[400px]">
              {authorBio || "Writer and thinker on SaaS Blog."}
            </p>
          </div>
        </div>

        {/* Follow/Unfollow Button */}
        {!isOwnPost && (
          <Button
            variant={followed ? "secondary" : "primary"}
            onClick={handleFollowToggle}
            disabled={followLoading}
            className="w-full md:w-auto h-9 text-13 px-4 rounded-12 select-none cursor-pointer"
          >
            {followed ? "Following" : "Follow"}
          </Button>
        )}
      </div>
    </div>
  );
}
