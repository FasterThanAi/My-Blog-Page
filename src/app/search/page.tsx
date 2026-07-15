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

  const [inputVal, setInputVal] = React.useState(query);
  const [data, setData] = React.useState<SearchData>({ posts: [], authors: [], tags: [] });
  const [loading, setLoading] = React.useState(false);

  // Sync state if query in URL changes
  React.useEffect(() => {
    const handle = requestAnimationFrame(() => {
      setInputVal(query);
    });
    return () => cancelAnimationFrame(handle);
  }, [query]);

  // Debounced search logic (300ms)
  React.useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = inputVal.trim();
      const params = new URLSearchParams(window.location.search);
      if (trimmed) {
        params.set("q", trimmed);
      } else {
        params.delete("q");
      }
      router.replace(`/search?${params.toString()}`);
    }, 300);

    return () => clearTimeout(timer);
  }, [inputVal, router]);

  // Fetch search data from route handler when URL query changes
  React.useEffect(() => {
    if (!query) {
      const handle = requestAnimationFrame(() => {
        setData({ posts: [], authors: [], tags: [] });
      });
      return () => cancelAnimationFrame(handle);
    }

    async function doSearch() {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error("Search fetch failed:", err);
      } finally {
        setLoading(false);
      }
    }

    doSearch();
  }, [query]);

  const hasResults = data.posts.length > 0 || data.authors.length > 0 || data.tags.length > 0;

  return (
    <div className="flex flex-col gap-8">
      {/* Search Input Bar */}
      <div className="relative">
        <Input
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder="Search posts, creators, or tags..."
          className="pl-12 h-14 text-17 rounded-16 focus-ring"
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
          description={`We couldn't find any matches for "${query}". Check your spelling or try searching for another term.`}
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
              <h2 className="text-15 font-semibold text-muted uppercase tracking-wider flex items-center gap-2">
                <Tag className="w-4 h-4" />
                Tags ({data.tags.length})
              </h2>
              <div className="flex flex-wrap gap-2">
                {data.tags.map((t) => (
                  <Link key={t.id} href={`/tag/${t.slug}`}>
                    <Badge variant="secondary" className="hover:border-accent hover:text-accent cursor-pointer">
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
              <h2 className="text-15 font-semibold text-muted uppercase tracking-wider flex items-center gap-2">
                <User className="w-4 h-4" />
                Authors ({data.authors.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {data.authors.map((author) => (
                  <Link key={author.id} href={`/profile/${author.username}`}>
                    <Card className="p-4 flex items-center gap-3.5 hover:translate-y-[-1px] transition-transform select-none cursor-pointer">
                      <Avatar src={author.avatar_url} fallback={author.display_name || author.username} size="md" />
                      <div className="flex-1 min-w-0">
                        <p className="text-15 font-semibold text-text truncate">
                          {author.display_name || author.username}
                        </p>
                        <p className="text-13 text-muted truncate">@{author.username}</p>
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
              <h2 className="text-15 font-semibold text-muted uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Articles ({data.posts.length})
              </h2>
              <div className="flex flex-col gap-4">
                {data.posts.map((post) => (
                  <Card key={post.id} className="p-6 flex flex-col gap-3 hover:translate-y-[-1px] transition-transform cursor-pointer">
                    <Link href={`/post/${post.slug}`} className="group">
                      <h3 className="text-20 font-semibold text-text group-hover:text-accent transition-colors leading-tight">
                        {post.title}
                      </h3>
                    </Link>
                    <div className="flex items-center gap-2 text-13 text-muted">
                      <Avatar src={post.author_avatar_url} fallback={post.author_username} size="sm" className="w-5 h-5" />
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
                    {/* snippet search highlight snippet */}
                    <p
                      className="text-15 text-muted leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: post.headline || post.excerpt }}
                    />
                  </Card>
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
              <Skeleton className="h-10 w-full rounded-12 animate-pulse" />
            </div>
          }
        >
          <SearchContent />
        </React.Suspense>
      </main>
    </div>
  );
}
