import * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GlassNav } from "@/components/ui/glass-nav";
import { TiptapRenderer } from "@/lib/renderer";
import { PostActions } from "@/components/post/post-actions";
import { ViewIncrementer } from "@/components/post/view-incrementer";
import { ArrowLeft } from "lucide-react";
import { CommentSection } from "@/components/post/comment-section";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function PostDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  // 1. Resolve Auth user context
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 2. Fetch the target post (supports both slug and direct uuid fallback lookup)
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(slug);

  let query = supabase
    .from("posts")
    .select("*, profiles!author_id(*)")
    .eq("status", "published");

  if (isUuid) {
    query = query.eq("id", slug);
  } else {
    query = query.eq("slug", slug);
  }

  const { data: post, error } = await query.maybeSingle();

  if (error || !post) {
    notFound();
  }

  // 3. Resolve initial reaction state indicators
  let initialLiked = false;
  let initialBookmarked = false;
  let initialFollowed = false;

  if (user) {
    const { data: react } = await supabase
      .from("reactions")
      .select("post_id")
      .eq("post_id", post.id)
      .eq("user_id", user.id)
      .eq("type", "like")
      .maybeSingle();
    initialLiked = !!react;

    const { data: bmark } = await supabase
      .from("bookmarks")
      .select("post_id")
      .eq("post_id", post.id)
      .eq("user_id", user.id)
      .maybeSingle();
    initialBookmarked = !!bmark;

    const { data: foll } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", user.id)
      .eq("following_id", post.author_id)
      .maybeSingle();
    initialFollowed = !!foll;
  }

  // 4. Resolve exact likes count
  const { count: likesCount } = await supabase
    .from("reactions")
    .select("*", { count: "exact", head: true })
    .eq("post_id", post.id)
    .eq("type", "like");

  const isOwnPost = user ? user.id === post.author_id : false;

  // Check comments feature flag
  const { data: commentsFlag } = await supabase
    .from("feature_flags")
    .select("enabled")
    .eq("key", "comments")
    .maybeSingle();

  const commentsEnabled = commentsFlag ? commentsFlag.enabled : true;

  return (
    <div className="min-h-screen bg-bg flex flex-col selection:bg-accent/20">
      <GlassNav />

      {/* View Incrementer Component */}
      <ViewIncrementer postId={post.id} />

      <main className="flex-1 w-full max-w-4xl mx-auto px-6 py-12 flex flex-col items-center">
        {/* Back navigation header link */}
        <div className="w-full max-w-[68ch] select-none mb-8">
          <Link
            href="/explore"
            className="inline-flex items-center gap-1.5 text-13 font-medium text-muted hover:text-text transition-colors group"
          >
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
            Back to Articles
          </Link>
        </div>

        {/* Long-form Reading Body: 68ch Max Width */}
        <article className="w-full max-w-[68ch] flex flex-col">
          {/* Post Header cover image if set */}
          {post.cover_image_url && post.cover_image_url.trim() !== "" && (
            <div className="w-full aspect-[16/9] rounded-24 overflow-hidden border border-border/40 select-none mb-10 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.cover_image_url}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Heading title */}
          <h1 className={`text-40 md:text-52 font-semibold tracking-tight leading-tight mb-8 ${post.is_hidden ? "text-muted italic select-none" : "text-text"}`}>
            {post.is_hidden ? "[removed by moderator]" : (post.title || "Untitled")}
          </h1>

          {/* Semantic SSR content renderer */}
          <div className="tiptap-reading-page">
            {post.is_hidden ? (
              <p className="text-15 text-muted italic select-none">[removed by moderator]</p>
            ) : (
              <TiptapRenderer content={post.content} />
            )}
          </div>

          {/* Interactive bookmarks, shares, reactions actions */}
          <PostActions
            postId={post.id}
            authorId={post.author_id}
            authorUsername={post.profiles.username}
            authorDisplayName={post.profiles.display_name}
            authorAvatarUrl={post.profiles.avatar_url}
            authorBio={post.profiles.bio}
            publishedAt={post.published_at}
            readingTime={post.reading_time_minutes || 1}
            views={post.view_count || 0}
            initialLikesCount={likesCount || 0}
            initialLiked={initialLiked}
            initialBookmarked={initialBookmarked}
            initialFollowed={initialFollowed}
            isOwnPost={isOwnPost}
          />

          {/* Discussion comments thread section */}
          {commentsEnabled && (
            <div className="border-t border-border/60 mt-16 pt-10">
              <CommentSection postId={post.id} postAuthorId={post.author_id} />
            </div>
          )}
        </article>
      </main>
    </div>
  );
}
