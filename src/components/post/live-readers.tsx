"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { Eye } from "lucide-react";

interface LiveReadersProps {
  postId: string;
}

/**
 * Shows a live "N people reading now" indicator using a Supabase Realtime
 * presence channel scoped to this post. No new tables — presence state
 * lives entirely in the realtime channel, cleared automatically when a
 * reader's tab closes/navigates away.
 */
export function LiveReaders({ postId }: LiveReadersProps) {
  const [count, setCount] = React.useState(1);

  React.useEffect(() => {
    const supabase = createClient();
    const clientId = Math.random().toString(36).slice(2);
    const channel = supabase.channel(`post-presence-${postId}`, {
      config: { presence: { key: clientId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setCount(Object.keys(state).length || 1);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId]);

  if (count <= 1) return null;

  return (
    <div className="mb-6">
      <span className="flex items-center gap-1.5 text-13 text-muted select-none">
        <Eye className="w-3.5 h-3.5 text-accent" />
        {count} reading now
      </span>
    </div>
  );
}
