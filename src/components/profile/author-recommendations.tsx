"use client";

import * as React from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  addRecommendationAction,
  removeRecommendationAction,
  listRecommendationsForUserAction,
} from "@/app/actions/recommendations";
import { X, Sparkles } from "lucide-react";

interface RecommendationRow {
  note: string | null;
  created_at: string;
  profiles: { id: string; username: string; display_name: string | null; avatar_url: string | null; bio: string | null };
}

interface AuthorRecommendationsProps {
  username: string;
  isOwnProfile: boolean;
}

export function AuthorRecommendations({ username, isOwnProfile }: AuthorRecommendationsProps) {
  const { toast } = useToast();
  const [recommendations, setRecommendations] = React.useState<RecommendationRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [newUsername, setNewUsername] = React.useState("");
  const [adding, setAdding] = React.useState(false);

  const load = React.useCallback(() => {
    setLoading(true);
    listRecommendationsForUserAction({ username })
      .then((data) => setRecommendations(data as unknown as RecommendationRow[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [username]);

  React.useEffect(() => {
    const handle = requestAnimationFrame(() => load());
    return () => cancelAnimationFrame(handle);
  }, [load]);

  const handleAdd = async () => {
    if (!newUsername.trim()) return;
    setAdding(true);
    try {
      await addRecommendationAction({ recommendedUsername: newUsername.trim() });
      setNewUsername("");
      load();
      toast("Author recommended", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to add recommendation", "error");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (recommendedId: string) => {
    try {
      await removeRecommendationAction({ recommendedId });
      setRecommendations((prev) => prev.filter((r) => r.profiles.id !== recommendedId));
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to remove recommendation", "error");
    }
  };

  if (loading) return null;
  if (recommendations.length === 0 && !isOwnProfile) return null;

  return (
    <div className="border-2 border-border bg-surface p-6 flex flex-col gap-4">
      <h3 className="text-17 font-bold text-text flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-accent" />
        {isOwnProfile ? "Authors you recommend" : "Recommends"}
      </h3>

      {recommendations.length === 0 ? (
        <p className="text-13 text-muted">No recommendations yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {recommendations.map((r) => (
            <div key={r.profiles.id} className="flex items-center gap-3">
              <Avatar src={r.profiles.avatar_url} fallback={r.profiles.username} size="sm" />
              <div className="flex-1 min-w-0">
                <Link
                  href={`/profile/${r.profiles.username}`}
                  className="text-13 font-bold text-text hover:text-accent transition-colors"
                >
                  {r.profiles.display_name || r.profiles.username}
                </Link>
                {r.note && <p className="text-12 text-muted truncate">{r.note}</p>}
              </div>
              {isOwnProfile && (
                <button
                  onClick={() => handleRemove(r.profiles.id)}
                  className="text-muted hover:text-red-500 cursor-pointer"
                  aria-label="Remove recommendation"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {isOwnProfile && (
        <div className="flex items-center gap-2 border-t border-border/40 pt-4">
          <Input
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            placeholder="username to recommend"
            className="flex-1 text-13"
          />
          <Button type="button" size="sm" onClick={handleAdd} disabled={adding || !newUsername.trim()}>
            {adding ? "Adding..." : "Add"}
          </Button>
        </div>
      )}
    </div>
  );
}
