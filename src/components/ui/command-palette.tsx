"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Modal } from "./modal";
import { Input } from "./input";
import { Edit3, Compass, Bookmark, Settings, SunMoon, Search, User, Tag } from "lucide-react";

interface ShortcutOption {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
}

interface ResultItem {
  id: string;
  type: "post" | "author" | "tag" | "shortcut";
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
  subtitle?: string;
}

export function CommandPalette() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const [isOpen, setIsOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<ResultItem[]>([]);
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  const listRef = React.useRef<HTMLDivElement>(null);

  // Toggle theme utility
  const toggleTheme = React.useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  // Command palette options shortcuts list
  const shortcuts = React.useMemo<ShortcutOption[]>(
    () => [
      { id: "new-post", label: "New Post", icon: Edit3, action: () => router.push("/write") },
      { id: "explore", label: "Explore Articles", icon: Compass, action: () => router.push("/explore") },
      { id: "bookmarks", label: "Bookmarks", icon: Bookmark, action: () => router.push("/bookmarks") },
      { id: "settings", label: "Settings", icon: Settings, action: () => router.push("/settings") },
      { id: "toggle-theme", label: "Toggle Theme (Light/Dark)", icon: SunMoon, action: toggleTheme },
    ],
    [router, toggleTheme]
  );

  // Listen for keyboard Cmd+K or Ctrl+K triggers
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Listen for custom trigger event (for mobile or button clicks)
  React.useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
    };

    window.addEventListener("open-command-palette", handleOpen);
    return () => window.removeEventListener("open-command-palette", handleOpen);
  }, []);

  // Close command palette and clear state
  const handleClose = React.useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setResults([]);
    setSelectedIndex(0);
  }, []);

  // Handle dynamic query search
  React.useEffect(() => {
    const defaultResults: ResultItem[] = shortcuts.map((s) => ({
      id: s.id,
      type: "shortcut",
      label: s.label,
      icon: s.icon,
      action: () => {
        s.action();
        handleClose();
      },
    }));

    if (!query.trim()) {
      const handle = requestAnimationFrame(() => {
        setResults(defaultResults);
        setSelectedIndex(0);
      });
      return () => cancelAnimationFrame(handle);
    }

    const timer = setTimeout(async () => {
      try {
        const fetchUrl = `/api/search?q=${encodeURIComponent(query)}`;
        const res = await fetch(fetchUrl);
        if (!res.ok) return;

        const data = await res.json();

        const searchResults: ResultItem[] = [];

        // 1. Group Tags first
        if (data.tags && data.tags.length > 0) {
          data.tags.slice(0, 3).forEach((tag: { id: string; name: string; slug: string }) => {
            searchResults.push({
              id: `tag-${tag.id}`,
              type: "tag",
              label: `#${tag.name}`,
              icon: Tag,
              subtitle: "Tag Category",
              action: () => {
                router.push(`/tag/${tag.slug}`);
                handleClose();
              },
            });
          });
        }

        // 2. Group Authors
        if (data.authors && data.authors.length > 0) {
          data.authors.slice(0, 3).forEach((author: { id: string; username: string; display_name: string }) => {
            searchResults.push({
              id: `author-${author.id}`,
              type: "author",
              label: author.display_name || author.username,
              icon: User,
              subtitle: `@${author.username}`,
              action: () => {
                router.push(`/profile/${author.username}`);
                handleClose();
              },
            });
          });
        }

        // 3. Group Posts
        if (data.posts && data.posts.length > 0) {
          data.posts.slice(0, 4).forEach((post: { id: string; title: string; slug: string }) => {
            searchResults.push({
              id: `post-${post.id}`,
              type: "post",
              label: post.title,
              icon: Search,
              subtitle: "Article",
              action: () => {
                router.push(`/post/${post.slug}`);
                handleClose();
              },
            });
          });
        }

        // Append fallback matching shortcuts
        const matchingShortcuts = defaultResults.filter((s) =>
          s.label.toLowerCase().includes(query.toLowerCase())
        );

        setResults([...searchResults, ...matchingShortcuts]);
      } catch (err) {
        console.error("Command palette search failed:", err);
      } finally {
        setSelectedIndex(0);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [query, shortcuts, router, handleClose]);

  // Navigate lists with arrow keys
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(results.length, 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + results.length) % Math.max(results.length, 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (results[selectedIndex]) {
          results[selectedIndex].action();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, results, selectedIndex]);

  // Auto-scroll highlighted list item into view
  React.useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex]);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} className="max-w-[560px] p-0 rounded-24 overflow-hidden border border-border/80 dark:border-white/12">
      {/* Search Input block */}
      <div className="relative border-b border-border/40 p-4">
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a command or search query..."
          className="pl-10 h-11 text-15 rounded-12 focus-ring"
        />
        <Search className="absolute left-7 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
      </div>

      {/* Results / List item list */}
      <div
        ref={listRef}
        className="max-h-[360px] overflow-y-auto p-2 flex flex-col gap-0.5 select-none"
      >
        {results.length === 0 ? (
          <div className="py-8 text-center text-13 text-muted">
            No shortcuts or results found
          </div>
        ) : (
          results.map((item, idx) => {
            const Icon = item.icon;
            const isSelected = idx === selectedIndex;
            return (
              <div
                key={item.id}
                onClick={item.action}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-12 transition-colors cursor-pointer select-none ${
                  isSelected ? "bg-accent/8 text-accent" : "text-text hover:bg-border/20"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isSelected ? "text-accent" : "text-muted"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-13 font-semibold truncate leading-none">{item.label}</p>
                  {item.subtitle && (
                    <p className="text-11 text-muted truncate mt-1 leading-none">{item.subtitle}</p>
                  )}
                </div>
                {item.type === "shortcut" && (
                  <span className="text-[10px] uppercase font-bold text-muted tracking-widest shrink-0 border border-border/60 rounded px-1.5 py-0.5 bg-raised">
                    Shortcut
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </Modal>
  );
}
