import * as React from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditorWorkspace } from "./editor-workspace";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function WriteIdPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // 1. Authenticate user server-side
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth/sign-in?returnTo=/write/${id}`);
  }

  // 2. Fetch post author and details
  const { data: post, error } = await supabase
    .from("posts")
    .select("id, author_id, title, content, cover_image_url, excerpt, status, visibility, seo_title, seo_description")
    .eq("id", id)
    .single();

  // 3. Return 404 if post doesn't exist or is owned by another user (quality gate security)
  if (error || !post || post.author_id !== user.id) {
    notFound();
  }

  // 4. Fetch the existing post tags
  const { data: postTags } = (await supabase
    .from("post_tags")
    .select("tags(name)")
    .eq("post_id", id)) as { data: { tags: { name: string } | null }[] | null };

  const initialTags = postTags
    ? postTags.map((pt) => pt.tags?.name).filter((name): name is string => typeof name === "string")
    : [];

  return (
    <EditorWorkspace
      post={post}
      initialTags={initialTags}
    />
  );
}
