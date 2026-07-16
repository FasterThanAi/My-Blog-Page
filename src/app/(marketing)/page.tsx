"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { GlassNav } from "@/components/ui/glass-nav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { getPublicLatestPostsAction } from "@/app/actions/public-posts";
import {
  ArrowRight,
  BookOpen,
  PenTool,
  Sparkles,
  ChevronRight,
} from "lucide-react";

interface PostItem {
  id: string;
  title: string;
  excerpt?: string | null;
  cover_image_url?: string | null;
  published_at: string;
  reading_time_minutes?: number | null;
  profiles: {
    username: string;
    display_name?: string | null;
    avatar_url?: string | null;
  };
}

export default function MarketingPage() {
  const shouldReduceMotion = useReducedMotion();
  const [latestPosts, setLatestPosts] = React.useState<PostItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Scroll properties for card parallax
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 800], [0, shouldReduceMotion ? 0 : -30]);
  const y2 = useTransform(scrollY, [0, 800], [0, shouldReduceMotion ? 0 : -15]);
  const y3 = useTransform(scrollY, [0, 800], [0, shouldReduceMotion ? 0 : -45]);

  React.useEffect(() => {
    getPublicLatestPostsAction({ cursor: null, tag: null })
      .then((data) => {
        setLatestPosts((data as PostItem[]).slice(0, 6));
      })
      .catch(() => {
        // Fail silently
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.06,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 8 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        ease: [0.32, 0.72, 0, 1] as [number, number, number, number],
        duration: 0.35,
      },
    },
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col overflow-x-hidden selection:bg-accent/20">
      <GlassNav />

      {/* Main Hero Section */}
      <main className="flex-1 flex flex-col items-center">
        <motion.section
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="mx-auto max-w-4xl px-6 pt-24 pb-20 text-center flex flex-col items-center gap-6 select-none"
        >
          <motion.div
            variants={itemVariants}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-border bg-surface text-13 font-medium text-muted shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
          >
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            Clarity in Reading & Writing
          </motion.div>

          <motion.h1
            variants={itemVariants}
            className="text-40 md:text-52 font-semibold tracking-tight text-text leading-[1.1] max-w-[700px] mt-2"
          >
            A calm environment for <br className="hidden md:block" />
            thoughtful expressions.
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="text-17 text-muted max-w-[560px] leading-relaxed"
          >
            Publish minimalist articles, draw vector graphics natively inside posts with Excalidraw, and join structured discussions.
          </motion.p>

          <motion.div
            variants={itemVariants}
            className="flex flex-wrap items-center justify-center gap-4 mt-6"
          >
            <Link href="/auth/sign-up">
              <Button size="lg" className="flex items-center gap-2">
                Join Publication
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/explore">
              <Button size="lg" variant="secondary" className="flex items-center gap-2">
                Explore Feed
                <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </motion.div>
        </motion.section>

        {/* 3 Floating Glass Feature Cards with Parallax on Scroll */}
        <section className="w-full max-w-5xl px-6 py-12 select-none">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <motion.div style={{ y: y1 }}>
              <Card className="flex flex-col gap-4 p-7 h-full bg-surface/72 dark:bg-surface/60 backdrop-blur-[16px] saturate-[1.4] border border-white/12 dark:border-white/12 shadow-[0_8px_32px_rgba(0,0,0,0.08)] rounded-24 transition-all hover:translate-y-[-2px]">
                <BookOpen className="w-7 h-7 text-accent" />
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-17 font-semibold text-text">1. Typographic Writing</h3>
                  <p className="text-13 text-muted leading-relaxed">
                    Tiptap editor featuring full markdown shortcuts, custom tables, syntax highlighted code codeblocks, and auto-excerpt suggestions.
                  </p>
                </div>
              </Card>
            </motion.div>

            <motion.div style={{ y: y2 }}>
              <Card className="flex flex-col gap-4 p-7 h-full bg-surface/72 dark:bg-surface/60 backdrop-blur-[16px] saturate-[1.4] border border-white/12 dark:border-white/12 shadow-[0_8px_32px_rgba(0,0,0,0.08)] rounded-24 transition-all hover:translate-y-[-2px]">
                <PenTool className="w-7 h-7 text-accent" />
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-17 font-semibold text-text">2. Sketch Blocks</h3>
                  <p className="text-13 text-muted leading-relaxed">
                    Interactive Excalidraw vector canvases loading dynamically on-demand, caching editable sketches, and saving responsive SVG previews.
                  </p>
                </div>
              </Card>
            </motion.div>

            <motion.div style={{ y: y3 }}>
              <Card className="flex flex-col gap-4 p-7 h-full bg-surface/72 dark:bg-surface/60 backdrop-blur-[16px] saturate-[1.4] border border-white/12 dark:border-white/12 shadow-[0_8px_32px_rgba(0,0,0,0.08)] rounded-24 transition-all hover:translate-y-[-2px]">
                <Sparkles className="w-7 h-7 text-accent" />
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-17 font-semibold text-text">3. Clean Feed Delivery</h3>
                  <p className="text-13 text-muted leading-relaxed">
                    Strict color layouts displaying latest, trending (views gravity decay), and followed updates without cluttering page visual spaces.
                  </p>
                </div>
              </Card>
            </motion.div>
          </div>
        </section>

        {/* Latest from Community Section */}
        <section className="w-full max-w-5xl px-6 py-20 border-t border-border mt-16 flex flex-col gap-8">
          <div className="flex flex-col gap-1">
            <h2 className="text-24 font-semibold text-text tracking-tight">Latest from the Community</h2>
            <p className="text-15 text-muted">Discover fresh ideas and articles published by creators.</p>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((n) => (
                <Card key={n} className="flex flex-col gap-3 p-5 animate-pulse">
                  <div className="w-full aspect-[16/10] bg-border/20 rounded-12 mb-2" />
                  <div className="h-5 w-3/4 bg-border/20 rounded-6" />
                  <div className="h-4 w-1/2 bg-border/20 rounded-6" />
                </Card>
              ))}
            </div>
          ) : latestPosts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {latestPosts.map((post) => (
                <Card key={post.id} className="flex flex-col h-full hover:border-accent/20 transition-colors p-5">
                  {post.cover_image_url && (
                    <div className="w-full aspect-[16/10] rounded-12 overflow-hidden mb-4 border border-border/50 relative">
                      <Image
                        src={post.cover_image_url}
                        alt={post.title || "Post cover image"}
                        fill
                        sizes="(max-width: 768px) 100vw, 300px"
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1 flex flex-col gap-2">
                    <Link
                      href={`/post/${post.id}`} // We fallback to loading post by ID if slug is not live yet
                      className="text-17 font-semibold text-text hover:text-accent transition-colors line-clamp-2"
                    >
                      {post.title || "Untitled"}
                    </Link>
                    <p className="text-13 text-muted line-clamp-3 leading-relaxed">
                      {post.excerpt || "No summary provided."}
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5 mt-5 pt-4 border-t border-border/40 select-none">
                    <Avatar
                      src={post.profiles.avatar_url}
                      fallback={post.profiles.username}
                      size="sm"
                    />
                    <div className="flex flex-col">
                      <span className="text-13 font-medium text-text">
                        {post.profiles.display_name || post.profiles.username}
                      </span>
                      <span className="text-11 text-muted">
                        {formatDate(post.published_at)} · {post.reading_time_minutes || 1} min read
                      </span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={BookOpen}
              title="No published posts yet"
              description="Be the first one to publish an article! Sign in and write a draft to begin."
              action={
                <Link href="/auth/sign-in">
                  <Button size="sm">Create First Post</Button>
                </Link>
              }
            />
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-surface shrink-0 select-none mt-20">
        <div className="mx-auto max-w-5xl px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <span className="text-15 font-semibold text-text uppercase tracking-wider">SaaS Blog</span>
            <span className="text-13 text-muted">© 2026 Antigravity. All rights reserved.</span>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/explore" className="text-13 text-muted hover:text-text transition-colors">
              Explore
            </Link>
            <Link href="/styleguide" className="text-13 text-muted hover:text-text transition-colors">
              Styleguide
            </Link>
            <Link href="/auth/sign-in" className="text-13 text-muted hover:text-text transition-colors">
              Sign In
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
