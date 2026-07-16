import * as React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GlassNav } from "@/components/ui/glass-nav";
import { ProfileLayout } from "@/components/profile/profile-layout";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, bio, avatar_url")
    .eq("username", username)
    .maybeSingle();

  if (!profile) {
    return {
      title: "Profile Not Found | SaaS Blog",
    };
  }

  const name = profile.display_name || profile.username;
  const description = profile.bio || `View the profile of ${name} on SaaS Blog.`;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const canonicalUrl = `${siteUrl}/profile/${username}`;

  return {
    title: `${name} (@${profile.username}) | SaaS Blog`,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `${name} (@${profile.username})`,
      description,
      url: canonicalUrl,
      type: "profile",
      username: profile.username,
      images: profile.avatar_url ? [{ url: profile.avatar_url }] : undefined,
    },
    twitter: {
      card: "summary",
      title: `${name} (@${profile.username})`,
      description,
      images: profile.avatar_url ? [profile.avatar_url] : undefined,
    },
  };
}

interface PageProps {
  params: Promise<{ username: string }>;
}

export default async function ProfilePage({ params }: PageProps) {
  const { username } = await params;
  const supabase = await createClient();

  // 1. Resolve Auth user context
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 2. Fetch the target user profile
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .maybeSingle();

  if (error || !profile) {
    notFound();
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    "name": profile.display_name || profile.username,
    "alternateName": profile.username,
    "description": profile.bio || "",
    "image": profile.avatar_url || undefined,
    "url": `${siteUrl}/profile/${username}`,
  };

  // 3. Resolve followers & following counts
  const { count: followersCount } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("following_id", profile.id);

  const { count: followingCount } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("follower_id", profile.id);

  // 4. Resolve public published posts authored by this user
  const { data: posts } = await supabase
    .from("posts")
    .select("*, profiles!author_id(*), reactions(count)")
    .eq("author_id", profile.id)
    .eq("status", "published")
    .eq("visibility", "public")
    .order("published_at", { ascending: false });

  // 5. Query private and draft metrics securely (only if looking at own profile)
  const isOwnProfile = user ? user.id === profile.id : false;
  let draftCount = 0;
  let privateCount = 0;

  if (isOwnProfile) {
    const { count: dCount } = await supabase
      .from("posts")
      .select("*", { count: "exact", head: true })
      .eq("author_id", profile.id)
      .eq("status", "draft");
    draftCount = dCount || 0;

    const { count: pCount } = await supabase
      .from("posts")
      .select("*", { count: "exact", head: true })
      .eq("author_id", profile.id)
      .eq("status", "published")
      .eq("visibility", "private");
    privateCount = pCount || 0;
  }

  // 6. Check follow status connection
  let initialFollowed = false;
  if (user && !isOwnProfile) {
    const { data: follow } = await supabase
      .from("follows")
      .select("*")
      .eq("follower_id", user.id)
      .eq("following_id", profile.id)
      .maybeSingle();
    initialFollowed = !!follow;
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col selection:bg-accent/20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <GlassNav />

      <main className="mx-auto max-w-4xl px-6 py-12 flex-1 w-full flex flex-col">
        <ProfileLayout
          profile={profile}
          posts={(posts as unknown as React.ComponentProps<typeof ProfileLayout>["posts"]) || []}
          followersCount={followersCount || 0}
          followingCount={followingCount || 0}
          draftCount={draftCount}
          privateCount={privateCount}
          initialFollowed={initialFollowed}
          isOwnProfile={isOwnProfile}
        />
      </main>
    </div>
  );
}
