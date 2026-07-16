import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface RSSPost {
  id: string;
  title: string | null;
  excerpt: string | null;
  slug: string | null;
  published_at: string | null;
  profiles: {
    display_name: string | null;
    username: string;
  } | null;
}

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const supabase = await createClient();

  const { data } = await supabase
    .from("posts")
    .select("id, title, excerpt, slug, published_at, profiles!author_id(display_name, username)")
    .eq("status", "published")
    .eq("visibility", "public")
    .order("published_at", { ascending: false })
    .limit(15);

  const posts = data as unknown as RSSPost[];

  const rssItems = (posts || [])
    .map((post) => {
      const postUrl = `${siteUrl}/post/${post.slug || post.id}`;
      const authorName = post.profiles?.display_name || post.profiles?.username || "Anonymous";
      return `
    <item>
      <title><![CDATA[${post.title || "Untitled Article"}]]></title>
      <link>${postUrl}</link>
      <guid isPermaLink="true">${postUrl}</guid>
      <pubDate>${new Date(post.published_at || new Date()).toUTCString()}</pubDate>
      <author><![CDATA[${authorName}]]></author>
      <description><![CDATA[${post.excerpt || ""}]]></description>
    </item>`;
    })
    .join("");

  const rssFeed = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>SaaS Blog</title>
    <link>${siteUrl}</link>
    <description>Minimalist reading page &amp; drawings</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/feed.xml" rel="self" type="application/rss+xml" />
    ${rssItems}
  </channel>
</rss>`;

  return new NextResponse(rssFeed, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
