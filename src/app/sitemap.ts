import { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const supabase = await createClient();

  const { data: posts } = await supabase
    .from("posts")
    .select("id, slug, updated_at")
    .eq("status", "published")
    .eq("visibility", "public")
    .order("published_at", { ascending: false });

  const postEntries = (posts || []).map((post) => ({
    url: `${siteUrl}/post/${post.slug || post.id}`,
    lastModified: new Date(post.updated_at || new Date()),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const routes = ["", "/explore", "/search", "/bookmarks"].map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: route === "" ? 1.0 : 0.8,
  }));

  return [...routes, ...postEntries];
}
