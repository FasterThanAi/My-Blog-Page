"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { GlassNav } from "@/components/ui/glass-nav";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import {
  markNotificationAsReadAction,
  markAllNotificationsAsReadAction,
} from "@/app/actions/notifications";

interface ActorProfile {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface PostInfo {
  title: string;
  slug: string;
}

interface NotificationItem {
  id: string;
  type: string;
  read_at: string | null;
  created_at: string;
  post_id: string | null;
  comment_id: string | null;
  actor: ActorProfile | null;
  posts: PostInfo | null;
}

interface NotificationRowProps {
  item: NotificationItem;
  onClick: () => void;
  renderDescription: (item: NotificationItem) => React.ReactNode;
}

function NotificationRow({ item, onClick, renderDescription }: NotificationRowProps) {
  const [relativeTime, setRelativeTime] = React.useState("...");

  React.useEffect(() => {
    const handle = requestAnimationFrame(() => {
      const diff = Date.now() - new Date(item.created_at).getTime();
      const secs = Math.floor(diff / 1000);
      const mins = Math.floor(secs / 60);
      const hrs = Math.floor(mins / 60);
      const days = Math.floor(hrs / 24);

      if (secs < 60) setRelativeTime("just now");
      else if (mins < 60) setRelativeTime(`${mins}m ago`);
      else if (hrs < 24) setRelativeTime(`${hrs}h ago`);
      else setRelativeTime(`${days}d ago`);
    });
    return () => cancelAnimationFrame(handle);
  }, [item.created_at]);

  const isUnread = !item.read_at;

  return (
    <div
      onClick={onClick}
      className={`p-4 flex items-center gap-4 transition-colors cursor-pointer hover:bg-raised/50 select-none ${
        isUnread ? "bg-accent/4 dark:bg-accent/2" : ""
      }`}
    >
      <Avatar
        src={item.actor?.avatar_url}
        fallback={item.actor?.display_name || item.actor?.username || "S"}
        size="md"
      />
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <p className="text-15 text-muted leading-snug">
          {renderDescription(item)}
        </p>
        <span className="text-13 text-muted">{relativeTime}</span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {isUnread && (
          <span className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse" />
        )}
        <ArrowRight className="w-4 h-4 text-muted/60" />
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const supabase = createClient();
  const router = useRouter();
  const { toast } = useToast();

  const [notifications, setNotifications] = React.useState<NotificationItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [userId, setUserId] = React.useState<string | null>(null);

  const fetchNotifications = React.useCallback(async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select(`
          id,
          type,
          read_at,
          created_at,
          post_id,
          comment_id,
          actor:profiles!actor_id(username, display_name, avatar_url),
          posts:post_id(title, slug)
        `)
        .eq("user_id", uid)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setNotifications((data as unknown as NotificationItem[]) || []);
    } catch (err) {
      console.error("Failed to load notifications:", err);
      toast("Failed to load notifications", "error");
    } finally {
      setLoading(false);
    }
  }, [supabase, toast]);

  React.useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth/sign-in?returnTo=/notifications");
        return;
      }

      setUserId(user.id);
      await fetchNotifications(user.id);
    }

    init();
  }, [supabase, router, fetchNotifications]);

  // Set up realtime channel to reload when a new notification is logged
  React.useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`user-notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchNotifications(userId);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [userId, supabase, fetchNotifications]);

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsAsReadAction();
      setNotifications((prev) =>
        prev.map((item) => ({ ...item, read_at: new Date().toISOString() }))
      );
      toast("All notifications marked as read", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to mark all as read", "error");
    }
  };

  const handleRowClick = async (item: NotificationItem) => {
    if (!item.read_at) {
      try {
        await markNotificationAsReadAction({ id: item.id });
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, read_at: new Date().toISOString() } : n))
        );
      } catch (err) {
        console.error("Failed to mark read:", err);
      }
    }

    // Navigate to target
    if (item.type === "follow" && item.actor) {
      router.push(`/profile/${item.actor.username}`);
    } else if ((item.type === "comment" || item.type === "reply") && item.posts) {
      const anchor = item.comment_id ? `#comment-${item.comment_id}` : "";
      router.push(`/post/${item.posts.slug}${anchor}`);
    } else if (item.type === "reaction" && item.posts) {
      router.push(`/post/${item.posts.slug}`);
    }
  };

  // Group notifications into Today, This Week, and Earlier
  const getGroupedNotifications = () => {
    const today: NotificationItem[] = [];
    const thisWeek: NotificationItem[] = [];
    const earlier: NotificationItem[] = [];

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const oneWeekAgo = startOfToday - 7 * 24 * 60 * 60 * 1000;

    notifications.forEach((item) => {
      const time = new Date(item.created_at).getTime();
      if (time >= startOfToday) {
        today.push(item);
      } else if (time >= oneWeekAgo) {
        thisWeek.push(item);
      } else {
        earlier.push(item);
      }
    });

    return { today, thisWeek, earlier };
  };

  const { today, thisWeek, earlier } = getGroupedNotifications();

  // Helper to format notification text
  const renderDescription = (item: NotificationItem) => {
    const actorName = item.actor?.display_name || item.actor?.username || "Someone";
    const postTitle = item.posts?.title || "your post";

    switch (item.type) {
      case "follow":
        return (
          <span>
            <strong className="text-text font-semibold">{actorName}</strong> started following you
          </span>
        );
      case "comment":
        return (
          <span>
            <strong className="text-text font-semibold">{actorName}</strong> commented on your article{" "}
            <span className="text-text font-semibold italic">&ldquo;{postTitle}&rdquo;</span>
          </span>
        );
      case "reply":
        return (
          <span>
            <strong className="text-text font-semibold">{actorName}</strong> replied to your comment on{" "}
            <span className="text-text font-semibold italic">&ldquo;{postTitle}&rdquo;</span>
          </span>
        );
      case "reaction":
        return (
          <span>
            <strong className="text-text font-semibold">{actorName}</strong> reacted to your article{" "}
            <span className="text-text font-semibold italic">&ldquo;{postTitle}&rdquo;</span>
          </span>
        );
      default:
        return <span>Social action received from {actorName}</span>;
    }
  };

  const renderSection = (title: string, list: NotificationItem[]) => {
    if (list.length === 0) return null;
    return (
      <div className="flex flex-col gap-3">
        <h3 className="text-13 font-semibold text-muted uppercase tracking-wider select-none px-1">
          {title}
        </h3>
        <div className="flex flex-col border border-border rounded-16 overflow-hidden bg-surface divide-y divide-border/40">
          {list.map((item) => (
            <NotificationRow
              key={item.id}
              item={item}
              onClick={() => handleRowClick(item)}
              renderDescription={renderDescription}
            />
          ))}
        </div>
      </div>
    );
  };

  const hasNotifications = notifications.length > 0;

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <GlassNav />

      <main className="mx-auto max-w-[640px] px-6 py-12 flex-1 flex flex-col gap-6 w-full">
        {/* Header block */}
        <div className="flex items-center justify-between border-b border-border/40 pb-4 select-none">
          <div className="flex flex-col gap-1">
            <h1 className="text-32 font-semibold tracking-tight text-text">Notifications</h1>
            <p className="text-15 text-muted">Updates about your posts and profile activity.</p>
          </div>
          {hasNotifications && notifications.some((n) => !n.read_at) && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              Mark all read
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col gap-6">
            <Skeleton className="h-6 w-24" />
            <Card className="flex flex-col gap-4 p-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </Card>
          </div>
        ) : !hasNotifications ? (
          <EmptyState
            icon={Bell}
            title="All caught up"
            description="You don't have any notifications at the moment. Keep publishing stories to engage with the community!"
          />
        ) : (
          <div className="flex flex-col gap-8">
            {renderSection("Today", today)}
            {renderSection("This week", thisWeek)}
            {renderSection("Earlier", earlier)}
          </div>
        )}
      </main>
    </div>
  );
}
