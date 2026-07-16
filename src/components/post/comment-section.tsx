"use client";

import * as React from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { createCommentAction } from "@/app/actions/comments";
import { CommentNodeComponent } from "@/components/post/comment-node";
import { MessageSquare } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { EmptyState } from "@/components/ui/empty-state";

interface CommentRaw {
  id: string;
  post_id: string;
  parent_id: string | null;
  author_id: string;
  body: string;
  is_deleted: boolean;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
  profiles: {
    username: string;
    display_name?: string | null;
    avatar_url?: string | null;
  };
  comment_votes: {
    comment_id: string;
    user_id: string;
    value: number;
  }[];
}

interface CommentNode {
  id: string;
  post_id: string;
  parent_id: string | null;
  author_id: string;
  body: string;
  is_deleted: boolean;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
  profiles: {
    username: string;
    display_name?: string | null;
    avatar_url?: string | null;
  };
  score: number;
  userVote: number;
  comment_votes: {
    comment_id: string;
    user_id: string;
    value: number;
  }[];
  children: CommentNode[];
}

interface CommentSectionProps {
  postId: string;
  postAuthorId: string;
}

export function CommentSection({ postId, postAuthorId }: CommentSectionProps) {
  const supabase = createClient();
  const { toast } = useToast();

  const [commentsRaw, setCommentsRaw] = React.useState<CommentRaw[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [currentUser, setCurrentUser] = React.useState<User | null>(null);
  const [newCommentBody, setNewCommentBody] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [sortBy, setSortBy] = React.useState<"top" | "new" | "old">("top");

  // Load Auth state & comments flat list
  const loadComments = React.useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUser(user);

      const { data, error } = await supabase
        .from("comments")
        .select("*, profiles!author_id(*), comment_votes(*)")
        .eq("post_id", postId);

      if (error) throw new Error(error.message);
      setCommentsRaw(data as unknown as CommentRaw[] || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load discussion thread";
      toast(message, "error");
    } finally {
      setLoading(false);
    }
  }, [supabase, postId, toast]);

  React.useEffect(() => {
    const handle = requestAnimationFrame(() => {
      loadComments();
    });
    return () => cancelAnimationFrame(handle);
  }, [loadComments]);

  // Builds tree structure from flat query result
  const commentTree = React.useMemo(() => {
    const commentMap: Record<string, CommentNode> = {};
    const roots: CommentNode[] = [];

    commentsRaw.forEach((c) => {
      const score = c.comment_votes?.reduce((acc, v) => acc + v.value, 0) || 0;
      const userVote = currentUser
        ? c.comment_votes?.find((v) => v.user_id === currentUser.id)?.value || 0
        : 0;

      commentMap[c.id] = {
        ...c,
        score,
        userVote,
        children: [],
      };
    });

    Object.values(commentMap).forEach((node) => {
      if (node.parent_id && commentMap[node.parent_id]) {
        commentMap[node.parent_id].children.push(node);
      } else {
        roots.push(node);
      }
    });

    // Node sorting helper
    const sortNodes = (nodes: CommentNode[]): CommentNode[] => {
      return nodes
        .map((n) => ({ ...n, children: sortNodes(n.children) }))
        .sort((a, b) => {
          if (sortBy === "new") {
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          }
          if (sortBy === "old") {
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          }
          // Top: score desc, ties by created_at desc
          if (b.score !== a.score) {
            return b.score - a.score;
          }
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
    };

    return sortNodes(roots);
  }, [commentsRaw, currentUser, sortBy]);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentBody.trim()) return;

    setSubmitting(true);
    try {
      await createCommentAction({
        postId,
        body: newCommentBody.trim(),
      });
      setNewCommentBody("");
      toast("Comment published", "success");
      await loadComments();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to publish comment";
      toast(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handlePostComment(e);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-4 animate-pulse select-none">
        <Skeleton className="h-6 w-32 rounded-8" />
        <Skeleton className="h-24 w-full rounded-16" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Top Thread composer */}
      {currentUser ? (
        <form onSubmit={handlePostComment} className="flex flex-col gap-3">
          <textarea
            value={newCommentBody}
            onChange={(e) => setNewCommentBody(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Join the discussion... (Cmd+Enter / Ctrl+Enter to submit)"
            maxLength={10000}
            rows={3}
            className="w-full text-15 rounded-16 border border-border bg-surface text-text placeholder:text-muted/40 outline-none p-4 focus:border-accent/40 focus:ring-1 focus:ring-accent/40 transition-all leading-normal"
          />
          <div className="flex items-center justify-end">
            <Button
              type="submit"
              disabled={submitting || !newCommentBody.trim()}
              className="h-9 px-4 text-13 rounded-12 cursor-pointer"
            >
              {submitting ? "Commenting..." : "Comment"}
            </Button>
          </div>
        </form>
      ) : (
        <Card className="p-6 bg-surface/50 border border-border select-none flex flex-col items-center gap-3 text-center">
          <p className="text-15 text-muted leading-relaxed">
            Sign in to join the discussion and share your thoughts.
          </p>
          <Link href="/auth/sign-in">
            <Button size="sm" className="cursor-pointer">Sign In to Comment</Button>
          </Link>
        </Card>
      )}

      {/* Sorting filters & counters bar */}
      <div className="flex items-center justify-between border-b border-border/40 pb-4 select-none mt-2">
        <span className="text-15 font-semibold text-text tracking-tight">
          {commentsRaw.length} Comment{commentsRaw.length !== 1 ? "s" : ""}
        </span>

        {commentsRaw.length > 0 && (
          <div className="flex items-center gap-1.5 text-13">
            <span className="text-muted">Sort by:</span>
            {([
              { id: "top", label: "Top" },
              { id: "new", label: "New" },
              { id: "old", label: "Old" },
            ] as const).map((opt) => {
              const active = sortBy === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSortBy(opt.id)}
                  className={`px-2 py-0.5 rounded-6 hover:bg-border/20 cursor-pointer font-medium transition-colors ${
                    active ? "text-accent bg-accent/5" : "text-muted hover:text-text"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Thread list recursive nodes rendering */}
      {commentTree.length > 0 ? (
        <ul className="flex flex-col gap-6 list-none pl-0" role="list" aria-label="Discussion thread comments">
          {commentTree.map((node) => (
            <CommentNodeComponent
              key={node.id}
              node={node}
              depth={0}
              postAuthorId={postAuthorId}
              currentUserId={currentUser?.id || null}
              onMutation={loadComments}
            />
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={MessageSquare}
          title="No comments yet"
          description="Be the first to start the conversation!"
        />
      )}
    </div>
  );
}
