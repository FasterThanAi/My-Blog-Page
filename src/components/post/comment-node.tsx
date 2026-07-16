"use client";

import * as React from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { ReportModal } from "@/components/post/report-modal";
import {
  createCommentAction,
  editCommentAction,
  deleteCommentAction,
  voteCommentAction,
} from "@/app/actions/comments";
import { ChevronUp, ChevronDown, MessageSquare, AlertCircle, Edit, Trash2 } from "lucide-react";

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
  children: CommentNode[];
}

interface CommentNodeComponentProps {
  node: CommentNode;
  depth: number;
  postAuthorId: string;
  currentUserId: string | null;
  onMutation: () => Promise<void>;
}

export function CommentNodeComponent({
  node,
  depth,
  postAuthorId,
  currentUserId,
  onMutation,
}: CommentNodeComponentProps) {
  const { toast } = useToast();

  const [isReplying, setIsReplying] = React.useState(false);
  const [replyBody, setReplyBody] = React.useState("");
  const [isEditing, setIsEditing] = React.useState(false);
  const [editBody, setEditBody] = React.useState(node.body);
  const [loading, setLoading] = React.useState(false);

  // Optimistic voting state
  const [userVote, setUserVote] = React.useState(node.userVote);
  const [score, setScore] = React.useState(node.score);
  // Guard: prevent concurrent vote requests (rapid clicking creates duplicate DB rows)
  const votingRef = React.useRef(false);

  // Collapsing state for depth > 4 threads
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [reportModalOpen, setReportModalOpen] = React.useState(false);

  // Format relative timestamp helper (computed in useEffect side-effect for pure renders)
  const [relativeTime, setRelativeTime] = React.useState("...");

  React.useEffect(() => {
    const handle = requestAnimationFrame(() => {
      const diff = Date.now() - new Date(node.created_at).getTime();
      const secs = Math.floor(diff / 1000);
      const mins = Math.floor(secs / 60);
      const hrs = Math.floor(mins / 60);
      const days = Math.floor(hrs / 24);

      if (secs < 60) {
        setRelativeTime("just now");
      } else if (mins < 60) {
        setRelativeTime(`${mins}m ago`);
      } else if (hrs < 24) {
        setRelativeTime(`${hrs}h ago`);
      } else {
        setRelativeTime(`${days}d ago`);
      }
    });
    return () => cancelAnimationFrame(handle);
  }, [node.created_at]);

  const handleVote = async (value: 1 | -1) => {
    if (!currentUserId) {
      toast("You must be signed in to vote", "error");
      return;
    }
    // Block if a vote request is already in flight
    if (votingRef.current) return;
    votingRef.current = true;

    // Capture current state for rollback BEFORE optimistic update
    const prevVote = userVote;
    const prevScore = score;

    // 1. Optimistic Update UI state
    let nextVote: number = value;
    if (userVote === value) {
      nextVote = 0; // Untoggle
    }

    setUserVote(nextVote);
    const scoreDiff = nextVote - userVote;
    setScore((prev) => prev + scoreDiff);

    try {
      const result = await voteCommentAction({ commentId: node.id, value });
      // Keep state in sync with server response (handles toggles/flips)
      setUserVote(result.value);
    } catch (err) {
      // 2. Rollback on error using pre-captured values
      setUserVote(prevVote);
      setScore(prevScore);
      const message = err instanceof Error ? err.message : "Failed to vote";
      toast(message, "error");
    } finally {
      votingRef.current = false;
    }
  };

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyBody.trim()) return;

    setLoading(true);
    try {
      await createCommentAction({
        postId: node.post_id,
        parentId: node.id,
        body: replyBody.trim(),
      });
      setReplyBody("");
      setIsReplying(false);
      toast("Reply published", "success");
      await onMutation();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to post reply";
      toast(message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editBody.trim()) return;

    setLoading(true);
    try {
      await editCommentAction({
        commentId: node.id,
        body: editBody.trim(),
      });
      setIsEditing(false);
      toast("Comment updated", "success");
      await onMutation();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update comment";
      toast(message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this comment?")) return;

    setLoading(true);
    try {
      await deleteCommentAction({ commentId: node.id });
      toast("Comment deleted", "success");
      await onMutation();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete comment";
      toast(message, "error");
      setLoading(false);
    }
  };

  const isOwnComment = currentUserId === node.author_id;
  const showCollapsePrompt = depth >= 4 && node.children.length > 0 && !isExpanded;

  return (
    <li id={`comment-${node.id}`} className="flex flex-col gap-2.5 select-none w-full list-none scroll-mt-24" role="listitem">
      {/* Target Comment Card Node */}
      <div className="flex gap-3">
        {/* Left Hand vote columns (▲ score ▼) */}
        <div className="flex flex-col items-center gap-1 mt-1.5 shrink-0 select-none">
          <button
            type="button"
            onClick={() => !node.is_hidden && handleVote(1)}
            disabled={node.is_hidden}
            className={`p-1 rounded transition-colors ${
              node.is_hidden 
                ? "text-border cursor-not-allowed" 
                : userVote === 1 
                ? "text-accent cursor-pointer hover:bg-border/20" 
                : "text-muted hover:text-text cursor-pointer hover:bg-border/20"
            }`}
            aria-label="Upvote comment"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <span
            className={`text-12 font-semibold select-none ${
              node.is_hidden
                ? "text-border"
                : userVote === 1
                ? "text-accent"
                : userVote === -1
                ? "text-red-500"
                : "text-text"
            }`}
          >
            {node.is_hidden ? "-" : score}
          </span>
          <button
            type="button"
            onClick={() => !node.is_hidden && handleVote(-1)}
            disabled={node.is_hidden}
            className={`p-1 rounded transition-colors ${
              node.is_hidden
                ? "text-border cursor-not-allowed"
                : userVote === -1
                ? "text-red-500 cursor-pointer hover:bg-border/20"
                : "text-muted hover:text-text cursor-pointer hover:bg-border/20"
            }`}
            aria-label="Downvote comment"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        {/* Right Hand content box details */}
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-13">
            <Avatar
              src={node.is_deleted ? null : node.profiles.avatar_url}
              fallback={node.is_deleted ? "?" : node.profiles.username}
              size="sm"
              className="w-6 h-6"
            />
            <span className="font-semibold text-text">
              {node.is_deleted ? "[deleted]" : node.profiles.display_name || node.profiles.username}
            </span>
            {node.author_id === postAuthorId && !node.is_deleted && (
              <Badge variant="accent" className="h-4.5 px-1 text-10 font-bold tracking-wide uppercase select-none rounded-4">
                Author
              </Badge>
            )}
            <span className="text-muted">@{node.is_deleted ? "[deleted]" : node.profiles.username}</span>
            <span className="text-muted">·</span>
            <span className="text-muted">{relativeTime}</span>
          </div>

          {/* Comment Body Render / Edit Form */}
          {isEditing ? (
            <form onSubmit={handleEditSubmit} className="flex flex-col gap-2 mt-1.5">
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                maxLength={10000}
                rows={2}
                className="w-full text-15 rounded-12 border border-border bg-surface text-text outline-none p-3 focus:border-accent/40 focus:ring-1 focus:ring-accent/40 transition-all leading-normal"
              />
              <div className="flex items-center gap-2 justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsEditing(false)}
                  disabled={loading}
                  className="h-8 text-12 rounded-8 px-3 cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading || !editBody.trim()}
                  className="h-8 text-12 rounded-8 px-3 cursor-pointer"
                >
                  Save
                </Button>
              </div>
            </form>
          ) : (
            <p
              className={`text-15 leading-relaxed leading-normal pr-4 ${
                (node.is_deleted || node.is_hidden) ? "text-muted italic select-none" : "text-text"
              }`}
            >
              {node.is_deleted
                ? "[deleted]"
                : node.is_hidden
                ? "[removed by moderator]"
                : node.body}
            </p>
          )}

          {/* Action Row options */}
          {!isEditing && !node.is_hidden && (
            <div className="flex flex-wrap items-center gap-4 text-12 text-muted select-none mt-1">
              <button
                type="button"
                onClick={() => {
                  if (!currentUserId) {
                    toast("You must be signed in to reply", "error");
                  } else {
                    setIsReplying(!isReplying);
                  }
                }}
                className="flex items-center gap-1 hover:text-text cursor-pointer transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Reply
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!currentUserId) {
                    toast("You must be signed in to report content", "error");
                  } else {
                    setReportModalOpen(true);
                  }
                }}
                className="flex items-center gap-1 hover:text-text cursor-pointer transition-colors"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                Report
              </button>

              {isOwnComment && !node.is_deleted && (
                <>
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-1 hover:text-text cursor-pointer transition-colors"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={loading}
                    className="flex items-center gap-1 text-red-500 hover:text-red-600 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </>
              )}
            </div>
          )}

          {/* Inline Reply Composer */}
          {isReplying && (
            <form onSubmit={handleReplySubmit} className="flex flex-col gap-2 mt-3 select-none">
              <textarea
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                placeholder="Write a reply..."
                maxLength={10000}
                rows={2}
                className="w-full text-15 rounded-12 border border-border bg-surface text-text outline-none p-3 focus:border-accent/40 focus:ring-1 focus:ring-accent/40 transition-all leading-normal"
              />
              <div className="flex items-center gap-2 justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsReplying(false)}
                  disabled={loading}
                  className="h-8 text-12 rounded-8 px-3 cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading || !replyBody.trim()}
                  className="h-8 text-12 rounded-8 px-3 cursor-pointer"
                >
                  Reply
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Flag Report Modal */}
      <ReportModal
        isOpen={reportModalOpen}
        commentId={node.id}
        onClose={() => setReportModalOpen(false)}
      />

      {/* Recursive children rendering block */}
      {node.children.length > 0 && (
        <div className="w-full select-none">
          {showCollapsePrompt ? (
            <div className="pl-7 mt-2 select-none">
              <button
                type="button"
                onClick={() => setIsExpanded(true)}
                className="text-13 font-semibold text-accent hover:underline cursor-pointer flex items-center gap-1"
              >
                Continue thread → ({node.children.length} reply{node.children.length !== 1 ? "ies" : ""})
              </button>
            </div>
          ) : (
            /* Flatten nesting indentation at depth >= 4 to preserve mobile layout */
            <ul
              className={`flex flex-col gap-5 list-none pl-0 ${
                depth < 4
                  ? "pl-5 border-l border-border/40 ml-2.5 mt-4"
                  : "mt-4 border-l border-accent/20 ml-2.5 pl-4"
              }`}
              role="list"
              aria-label="Replies"
            >
              {node.children.map((child) => (
                <CommentNodeComponent
                  key={child.id}
                  node={child}
                  depth={depth + 1}
                  postAuthorId={postAuthorId}
                  currentUserId={currentUserId}
                  onMutation={onMutation}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}
