"use client";

import * as React from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { GlassNav } from "@/components/ui/glass-nav";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { createNoteAction, listNotesFeedAction, deleteNoteAction, toggleNoteLikeAction } from "@/app/actions/notes";
import { formatRelativeTime } from "@/lib/format-time";
import { MessageSquareText, Heart, Trash2 } from "lucide-react";
import type { User } from "@supabase/supabase-js";

interface NoteItem {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  profiles: { username: string; display_name: string | null; avatar_url: string | null };
  note_likes: { count: number }[];
}

export default function NotesPage() {
  const supabase = createClient();
  const { toast } = useToast();

  const [user, setUser] = React.useState<User | null>(null);
  const [notes, setNotes] = React.useState<NoteItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [draft, setDraft] = React.useState("");
  const [posting, setPosting] = React.useState(false);
  const [likedIds, setLikedIds] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, [supabase]);

  const loadFeed = React.useCallback(() => {
    setLoading(true);
    listNotesFeedAction({ cursor: null })
      .then((data) => setNotes(data as NoteItem[]))
      .catch((err) => toast(err instanceof Error ? err.message : "Failed to load notes", "error"))
      .finally(() => setLoading(false));
  }, [toast]);

  React.useEffect(() => {
    const handle = requestAnimationFrame(() => {
      loadFeed();
    });
    return () => cancelAnimationFrame(handle);
  }, [loadFeed]);

  const handlePost = async () => {
    if (!draft.trim()) return;
    setPosting(true);
    try {
      const note = await createNoteAction({ body: draft.trim() });
      setNotes((prev) => [{ ...note, note_likes: [{ count: 0 }] } as NoteItem, ...prev]);
      setDraft("");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to post note", "error");
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (noteId: string) => {
    try {
      await deleteNoteAction({ noteId });
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to delete note", "error");
    }
  };

  const handleLike = async (noteId: string) => {
    try {
      const result = await toggleNoteLikeAction({ noteId });
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (result.liked) next.add(noteId);
        else next.delete(noteId);
        return next;
      });
      setNotes((prev) =>
        prev.map((n) =>
          n.id === noteId
            ? { ...n, note_likes: [{ count: (n.note_likes?.[0]?.count || 0) + (result.liked ? 1 : -1) }] }
            : n
        )
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to like note", "error");
    }
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <GlassNav />

      <main className="mx-auto max-w-2xl px-6 py-12 flex-1 flex flex-col gap-6 w-full">
        <div className="flex flex-col gap-1.5 select-none">
          <h1 className="text-32 font-black tracking-tight text-text">Notes</h1>
          <p className="text-15 text-muted">Short updates from every writer on the blog, newest first.</p>
        </div>

        {user ? (
          <div className="border-2 border-border bg-surface p-4 flex flex-col gap-3">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 500))}
              placeholder="Share a quick thought..."
              rows={3}
              className="w-full bg-transparent text-15 text-text placeholder:text-muted/60 outline-none resize-none"
            />
            <div className="flex items-center justify-between">
              <span className="text-11 text-muted">{draft.length}/500</span>
              <Button size="sm" onClick={handlePost} disabled={posting || !draft.trim()}>
                {posting ? "Posting..." : "Post"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="border-2 border-dashed border-border p-4 text-13 text-muted text-center">
            <Link href="/auth/sign-in" className="text-accent font-bold hover:underline">
              Sign in
            </Link>{" "}
            to post a note.
          </div>
        )}

        {loading ? (
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map((n) => (
              <Skeleton key={n} className="h-20 w-full" />
            ))}
          </div>
        ) : notes.length === 0 ? (
          <EmptyState icon={MessageSquareText} title="No notes yet" description="Be the first to share a thought." />
        ) : (
          <div className="flex flex-col">
            {notes.map((note) => {
              const isLiked = likedIds.has(note.id);
              const likeCount = note.note_likes?.[0]?.count || 0;
              const isOwn = user?.id === note.author_id;

              return (
                <div key={note.id} className="py-5 border-b border-border/60 flex gap-3 items-start">
                  <Avatar src={note.profiles.avatar_url} fallback={note.profiles.username} size="sm" />
                  <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 text-13">
                      <Link
                        href={`/profile/${note.profiles.username}`}
                        className="font-bold text-text hover:text-accent transition-colors"
                      >
                        {note.profiles.display_name || note.profiles.username}
                      </Link>
                      <span className="text-muted">· {formatRelativeTime(note.created_at)}</span>
                    </div>
                    <p className="text-15 text-text leading-relaxed whitespace-pre-wrap">{note.body}</p>
                    <div className="flex items-center gap-4 mt-1">
                      <button
                        onClick={() => handleLike(note.id)}
                        className={`flex items-center gap-1.5 text-13 cursor-pointer transition-colors ${
                          isLiked ? "text-red-500" : "text-muted hover:text-red-500"
                        }`}
                      >
                        <Heart className={`w-3.5 h-3.5 ${isLiked ? "fill-current" : ""}`} />
                        {likeCount > 0 ? likeCount : ""}
                      </button>
                      {isOwn && (
                        <button
                          onClick={() => handleDelete(note.id)}
                          className="flex items-center gap-1.5 text-13 text-muted hover:text-red-500 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
