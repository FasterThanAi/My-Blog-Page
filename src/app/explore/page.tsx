"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { GlassNav } from "@/components/ui/glass-nav";
import { Tabs } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { LatestFeed } from "./latest-feed";
import { TrendingFeed } from "./trending-feed";
import { FollowingFeed } from "./following-feed";
import { useToast } from "@/components/ui/toast";

export default function ExplorePage() {
  const supabase = createClient();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = React.useState("latest");
  const [tags, setTags] = React.useState<string[]>([]);
  const [selectedTag, setSelectedTag] = React.useState<string | null>(null);

  // Fetch tag filters dynamically on mount
  React.useEffect(() => {
    async function loadTags() {
      try {
        const { data, error } = await supabase
          .from("tags")
          .select("name")
          .order("name")
          .limit(12);

        if (!error && data) {
          setTags(data.map((t) => t.name));
        }
      } catch {
        toast("Failed to load tag categories", "error");
      }
    }
    loadTags();
  }, [supabase, toast]);

  const exploreTabs = [
    { id: "latest", label: "Latest Feed" },
    { id: "trending", label: "Trending" },
    { id: "following", label: "Following" },
  ];

  const handleTagToggle = (tag: string) => {
    if (selectedTag === tag) {
      setSelectedTag(null);
    } else {
      setSelectedTag(tag);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <GlassNav />

      <main className="mx-auto max-w-4xl px-6 py-12 flex-1 flex flex-col gap-6 w-full">
        <div className="flex flex-col gap-1.5 select-none">
          <h1 className="text-32 font-semibold tracking-tight text-text">Explore Articles</h1>
          <p className="text-15 text-muted">Stay up to date with posts, reviews, and design sketches.</p>
        </div>

        {/* Horizontal scrollable tags bar */}
        <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none select-none border-b border-border/40 pb-4">
          <span className="text-13 text-muted shrink-0 mr-1.5">Categories:</span>
          {tags.map((tag) => {
            const isActive = selectedTag === tag;
            return (
              <button
                key={tag}
                type="button"
                onClick={() => handleTagToggle(tag)}
                className="cursor-pointer transition-transform duration-100"
              >
                <Badge variant={isActive ? "accent" : "secondary"}>
                  #{tag}
                </Badge>
              </button>
            );
          })}
        </div>

        {/* Feed Tab Triggers */}
        <Tabs tabs={exploreTabs} activeTab={activeTab} onChange={(id) => setActiveTab(id)} className="mb-2" />

        {/* Feed Contents */}
        <div className="flex-1 flex flex-col">
          {activeTab === "latest" && <LatestFeed selectedTag={selectedTag} />}
          {activeTab === "trending" && <TrendingFeed selectedTag={selectedTag} />}
          {activeTab === "following" && <FollowingFeed selectedTag={selectedTag} />}
        </div>
      </main>
    </div>
  );
}
