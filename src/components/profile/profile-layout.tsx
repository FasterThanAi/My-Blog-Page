"use client";

import * as React from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { toggleFollowAction } from "@/app/actions/public-posts";
import {
  Link as LinkIcon,
  Calendar,
  BookOpen,
  FileText,
  Lock,
  Heart,
} from "lucide-react";

interface PostItem {
  id: string;
  title: string;
  excerpt?: string | null;
  cover_image_url?: string | null;
  published_at: string;
  reading_time_minutes?: number | null;
  reactions: { count: number }[];
}

interface ProfileLayoutProps {
  profile: {
    id: string;
    username: string;
    display_name?: string | null;
    avatar_url?: string | null;
    bio?: string | null;
    website_url?: string | null;
    created_at: string;
  };
  posts: PostItem[];
  followersCount: number;
  followingCount: number;
  draftCount: number;
  privateCount: number;
  initialFollowed: boolean;
  isOwnProfile: boolean;
}

export function ProfileLayout({
  profile,
  posts,
  followersCount,
  followingCount,
  draftCount,
  privateCount,
  initialFollowed,
  isOwnProfile,
}: ProfileLayoutProps) {
  const { toast } = useToast();

  const [followed, setFollowed] = React.useState(initialFollowed);
  const [followers, setFollowers] = React.useState(followersCount);
  const [followLoading, setFollowLoading] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState("posts");

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  };

  const handleFollowToggle = async () => {
    if (isOwnProfile) return;
    setFollowLoading(true);

    try {
      const result = await toggleFollowAction({ followingId: profile.id });
      setFollowed(result.followed);
      setFollowers((prev) => (result.followed ? prev + 1 : Math.max(0, prev - 1)));
      toast(
        result.followed ? `Now following ${profile.username}` : `Unfollowed ${profile.username}`,
        "success"
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update follow";
      toast(message, "error");
    } finally {
      setFollowLoading(false);
    }
  };

  const profileTabs = [
    { id: "posts", label: "Posts" },
    { id: "about", label: "About" },
  ];

  return (
    <div className="flex flex-col gap-8 select-none">
      {/* Header section details */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-6 border-b border-border/40">
        <div className="flex items-start gap-5">
          <Avatar
            src={profile.avatar_url}
            fallback={profile.username}
            size="lg"
            className="w-[96px] h-[96px]"
          />
          <div className="flex flex-col gap-2 pt-1.5">
            <div className="flex items-baseline gap-2">
              <h1 className="text-24 font-semibold text-text tracking-tight">
                {profile.display_name || profile.username}
              </h1>
              <span className="text-13 text-muted">@{profile.username}</span>
            </div>
            {profile.bio && <p className="text-15 text-muted leading-relaxed max-w-[500px]">{profile.bio}</p>}
            <div className="flex flex-wrap items-center gap-4 text-13 text-muted mt-1.5">
              {profile.website_url && (
                <a
                  href={profile.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-accent transition-colors"
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                  {profile.website_url.replace(/^https?:\/\/(www\.)?/, "")}
                </a>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Joined {formatDate(profile.created_at)}
              </span>
            </div>
          </div>
        </div>

        {/* Edit / Follow button trigger */}
        <div className="w-full md:w-auto flex flex-col items-stretch md:items-end gap-3 self-stretch md:self-auto select-none">
          {isOwnProfile ? (
            <Link href="/settings">
              <Button variant="secondary" className="w-full md:w-auto h-9 text-13 px-4 rounded-12 cursor-pointer">
                Edit Profile
              </Button>
            </Link>
          ) : (
            <Button
              variant={followed ? "secondary" : "primary"}
              onClick={handleFollowToggle}
              disabled={followLoading}
              className="w-full md:w-auto h-9 text-13 px-4 rounded-12 cursor-pointer"
            >
              {followed ? "Following" : "Follow"}
            </Button>
          )}

          {/* Followers stats */}
          <div className="flex items-center justify-center md:justify-end gap-4 text-13 text-muted px-1.5">
            <span>
              <strong className="text-text font-semibold">{followers}</strong> followers
            </span>
            <span>
              <strong className="text-text font-semibold">{followingCount}</strong> following
            </span>
          </div>
        </div>
      </div>

      {/* Private/Draft counters for own view only */}
      {isOwnProfile && (draftCount > 0 || privateCount > 0) && (
        <div className="flex items-center gap-3 bg-surface/50 border border-border px-4 py-3 rounded-12 text-13 text-muted">
          <span>Your writing metrics:</span>
          {draftCount > 0 && (
            <span className="flex items-center gap-1 text-accent font-medium">
              <FileText className="w-3.5 h-3.5" />
              {draftCount} drafts
            </span>
          )}
          {privateCount > 0 && (
            <span className="flex items-center gap-1 text-muted font-medium">
              <Lock className="w-3.5 h-3.5" />
              {privateCount} private
            </span>
          )}
        </div>
      )}

      {/* Tabs explore triggers */}
      <Tabs tabs={profileTabs} activeTab={activeTab} onChange={(id) => setActiveTab(id)} />

      {/* Tab panels details */}
      <div className="flex-1 flex flex-col">
        {activeTab === "posts" ? (
          posts.length > 0 ? (
            <div className="flex flex-col">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="py-6 border-b border-border/60 hover:bg-border/10 px-4 rounded-16 transition-all duration-150 flex gap-6 items-start"
                >
                  <div className="flex-1 flex flex-col gap-2 min-w-0">
                    <span className="text-11 text-muted select-none">
                      {new Date(post.published_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    <Link
                      href={`/post/${post.id}`}
                      className="text-17 font-semibold tracking-tight text-text hover:text-accent transition-colors truncate block"
                    >
                      {post.title || "Untitled"}
                    </Link>
                    <p className="text-13 text-muted leading-relaxed line-clamp-2">
                      {post.excerpt || "No description preview available."}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-11 text-muted select-none">
                      <span>{post.reading_time_minutes || 1} min read</span>
                      {post.reactions?.[0]?.count > 0 && (
                        <span className="flex items-center gap-1 text-red-500 font-medium">
                          <Heart className="w-3 h-3 fill-current" />
                          {post.reactions[0].count}
                        </span>
                      )}
                    </div>
                  </div>

                  {post.cover_image_url && (
                    <div className="w-24 md:w-28 aspect-[16/10] shrink-0 rounded-12 overflow-hidden border border-border/40 select-none">
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
          ) : (
            <EmptyState
              icon={BookOpen}
              title="No published posts"
              description={`${profile.display_name || profile.username} hasn't published any articles yet.`}
            />
          )
        ) : (
          <Card className="p-6 flex flex-col gap-4 bg-surface border-border select-none">
            <h3 className="text-17 font-semibold text-text">Bio & Description</h3>
            <p className="text-15 text-muted leading-relaxed">
              {profile.bio || "No biography provided by the author."}
            </p>
            {profile.website_url && (
              <div className="flex flex-col gap-1 border-t border-border pt-4 mt-2 text-13">
                <span className="text-muted">Website Link:</span>
                <a
                  href={profile.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  {profile.website_url}
                </a>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
