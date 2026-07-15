"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "./avatar";
import { Button } from "./button";
import { ThemeToggle } from "./theme-toggle";
import { Card } from "./card";
import { LogOut, Settings, Edit } from "lucide-react";

interface Profile {
  avatar_url: string | null;
  display_name: string | null;
  username: string;
}

export function GlassNav() {
  const supabase = createClient();
  const router = useRouter();
  const [user, setUser] = React.useState<SupabaseUser | null>(null);
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  const fetchProfile = React.useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("avatar_url, display_name, username")
        .eq("id", userId)
        .single();

      if (!error && data) {
        setProfile(data as Profile);
      }
    } catch {
      // Ignore profile load errors silently for now
    }
  }, [supabase]);

  React.useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
      }
      setLoading(false);
    };

    getSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, fetchProfile]);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setMenuOpen(false);
    router.push("/");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 w-full glass-effect select-none">
      <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="text-17 font-semibold text-text tracking-tight hover:opacity-80 transition-opacity">
          SaaS Blog
        </Link>

        {/* Right Nav */}
        <div className="flex items-center gap-4">
          <ThemeToggle />

          {loading ? (
            <div className="w-[44px] h-[44px] rounded-full bg-border/20 animate-pulse" />
          ) : user ? (
            <div className="flex items-center gap-4 relative" ref={menuRef}>
              <Link href="/write">
                <Button variant="ghost" size="sm" className="hidden sm:inline-flex items-center gap-2">
                  <Edit className="w-4 h-4" />
                  Write
                </Button>
              </Link>

              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="focus-ring rounded-full cursor-pointer hover:opacity-90 transition-opacity"
              >
                <Avatar
                  src={profile?.avatar_url}
                  fallback={profile?.display_name || profile?.username || user.email || ""}
                  size="md"
                />
              </button>

              {menuOpen && (
                <Card className="absolute right-0 top-14 w-52 p-2 bg-surface border border-border shadow-lg flex flex-col z-50">
                  <div className="px-3 py-2 border-b border-border mb-1">
                    <p className="text-13 font-semibold truncate text-text">
                      {profile?.display_name || "User"}
                    </p>
                    <p className="text-13 text-muted truncate">
                      @{profile?.username || "username"}
                    </p>
                  </div>
                  <Link href="/settings" onClick={() => setMenuOpen(false)}>
                    <Button variant="ghost" size="sm" className="w-full justify-start gap-2 h-9">
                      <Settings className="w-4 h-4 text-muted" />
                      Settings
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSignOut}
                    className="w-full justify-start gap-2 text-red-600 hover:text-red-700 hover:bg-red-500/10 h-9"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </Button>
                </Card>
              )}
            </div>
          ) : (
            <Link href="/auth/sign-in">
              <Button size="sm">Sign in</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
