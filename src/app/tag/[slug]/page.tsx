import * as React from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GlassNav } from "@/components/ui/glass-nav";
import { LatestFeed } from "@/app/explore/latest-feed";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function TagPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: tag, error } = await supabase
    .from("tags")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !tag) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <GlassNav />
      <main className="mx-auto max-w-4xl px-6 py-12 flex-1 flex flex-col gap-6 w-full">
        <div className="flex flex-col gap-1.5 select-none">
          <h1 className="text-32 font-semibold tracking-tight text-text">#{tag.name}</h1>
          <p className="text-15 text-muted">Explore posts categorized under #{tag.name}.</p>
        </div>
        <div className="flex-1 flex flex-col mt-4">
          <LatestFeed selectedTag={tag.name} />
        </div>
      </main>
    </div>
  );
}
