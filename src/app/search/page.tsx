"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Search as SearchIcon, User, Tag, FileText, ArrowRight } from "lucide-react";
import { GlassNav } from "@/components/ui/glass-nav";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

interface SearchPostResult {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  published_at: string;
  author_username: string;
  author_display_name: string;
  author_avatar_url: string;
  headline: string;
  rank: number;
}

interface SearchAuthorResult {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  bio: string;
}

interface SearchTagResult {
  id: string;
  name: string;
  slug: string;
}

interface SearchData {
  posts: SearchPostResult[];
  authors: SearchAuthorResult[];
  tags: SearchTagResult[];
}

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get("q") || "";

  // inputVal is what the user is typing right now
  const [inputVal, setInputVal] = React.useState(query);
  const [data, setData] = React.useState<SearchData>({ posts: [], authors: [], tags: [] });
  const [loading, setLoading] = React.useState(false);

  // Track whether the user is focused on the input so we don't overwrite their typing
  const isFocusedRef = React.useRef(false);

  // Only sync URL→input when not focused (e.g. user navigates back/forward)
  React.useEffect(() => {
    if (!isFocusedRef.current) {
      setInputVal(query);
    }
  }, [query]);

  // Debounce: update URL 400ms after user stops typing
  React.useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = inputVal.trim();
      const current = new URLSearchParams(window.location.search).get("q") || "";
      // Only push if actually different to avoid triggering the sync above
      if (trimmed !== current) {
        const params = new URLSearchParams();
        if (trimmed) params.set("q", trimmed);
        router.replace(`/search?${params.toString()}`);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [inputVal, router]);

  // Fetch results whenever the URL query param changes
  React.useEffect(() => {
    if (!query) {
      setData({ posts: [], authors: [], tags: [] });
      return;
    }

    let cancelled = false;
    async function doSearch() {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok && !cancelled) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error("Search fetch failed:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    doSearch();
    return () => { cancelled = true; };
  }, [query]);

  const hasResults = data.posts.length > 0 || data.authors.length > 0 || data.tags.length > 0;

  return (
    <div className="flex flex-col gap-8">
      {/* Search Input Bar */}
      <div className="relative">
        <Input
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onFocus={() => { isFocusedRef.current = true; }}
          onBlur={() => { isFocusedRef.current = false; }}
          placeholder="Search posts, creators, or tags..."
          className="pl-12 h-14 text-17 rounded-16 focus-ring"
          autoFocus
        />
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted pointer-events-none" />
      </div>

      {loading ? (
        <div className="flex flex-col gap-6">
          <Skeleton className="h-6 w-32" />
          <Card className="p-6 flex flex-col gap-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </Card>
          <Card className="p-6 flex flex-col gap-4">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </Card>
        </div>
      ) : query && !hasResults ? (
        <EmptyState
          icon={SearchIcon}
          title="No results found"
          description={`We couldn't find any matches for "${query}". Check your spelling or try a tag, username, or different keyword.`}
        />
      ) : !query ? (
        <EmptyState
          icon={SearchIcon}
          title="Start searching"
          description="Type keywords to find published articles, author usernames, or tags."
        />
      ) : (
        <div className="flex flex-col gap-8">
          {/* Tags results */}
          {data.tags.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-13 font-semibold text-muted uppercase tracking-wider flex items-center gap-2">
                <Tag className="w-4 h-4" />
                Tags ({data.tags.length})
              </h2>
              <div className="flex flex-wrap gap-2">
                {data.tags.map((t) => (
                  <Link key={t.id} href={`/tag/${t.slug}`}>
                    <Badge variant="secondary" className="px-3 py-1.5 text-13 hover:border-accent hover:text-accent cursor-pointer transition-colors">
                      #{t.name}
                    </Badge>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Authors results */}
          {data.authors.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-13 font-semibold text-muted uppercase tracking-wider flex items-center gap-2">
                <User className="w-4 h-4" />
                Authors ({data.authors.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.authors.map((author) => (
                  <Link key={author.id} href={`/profile/${author.username}`}>
                    <Card className="p-4 flex items-center gap-3.5 hover:translate-y-[-1px] transition-transform select-none cursor-pointer">
                      <Avatar src={author.avatar_url} fallback={author.display_name || author.username} size="md" />
                      <div className="flex-1 min-w-0">
                        <p className="text-15 font-semibold text-text truncate">
                          {author.display_name || author.username}
                        </p>
                        <p className="text-13 text-muted truncate">@{author.username}</p>
                        {author.bio && (
                          <p className="text-12 text-muted truncate mt-0.5">{author.bio}</p>
                        )}
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted shrink-0" />
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Posts results */}
          {data.posts.length > 0 && (
            <div className="flex flex-col gap-4">
              <h2 className="text-13 font-semibold text-muted uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Articles ({data.posts.length})
              </h2>
              <div className="flex flex-col gap-3">
                {data.posts.map((post) => (
                  <Link key={post.id} href={`/post/${post.slug || post.id}`}>
                    <Card className="p-5 flex flex-col gap-2 hover:translate-y-[-1px] transition-transform cursor-pointer group">
                      <h3 className="text-18 font-semibold text-text group-hover:text-accent transition-colors leading-snug">
                        {post.title}
                      </h3>
                      <div className="flex items-center gap-2 text-12 text-muted">
                        <Avatar src={post.author_avatar_url} fallback={post.author_username} size="sm" className="w-4 h-4" />
                        <span>{post.author_display_name || post.author_username}</span>
                        <span>·</span>
                        <span>
                          {new Date(post.published_at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                      {/* Highlighted excerpt from full-text search, or plain excerpt for tag matches */}
                      {(post.headline || post.excerpt) && (
                        <p
                          className="text-14 text-muted leading-relaxed line-clamp-2"
                          dangerouslySetInnerHTML={{ __html: post.headline || post.excerpt }}
                        />
                      )}
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <GlassNav />
      <main className="mx-auto max-w-3xl px-6 py-12 flex-1 w-full">
        <React.Suspense
          fallback={
            <div className="flex flex-col gap-6">
              <Skeleton className="h-14 w-full rounded-16 animate-pulse" />
            </div>
          }
        >
          <SearchContent />
        </React.Suspense>
      </main>
    </div>
  );
}
