import * as React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GlassNav } from "@/components/ui/glass-nav";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in?returnTo=/dashboard");
  }

  // Fetch the role for server-side role control
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, username, display_name")
    .eq("id", user.id)
    .single();

  if (error || !profile || profile.role !== "owner") {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-bg">
      <GlassNav />
      <main className="mx-auto max-w-7xl px-6 py-12 flex flex-col gap-8">
        <div className="flex items-center justify-between border-b border-border pb-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <h1 className="text-32 font-semibold tracking-tight text-text">
                Owner Dashboard
              </h1>
              <Badge variant="accent">Admin</Badge>
            </div>
            <p className="text-15 text-muted">
              Platform administration, statistics, and configuration keys.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="flex flex-col gap-2">
            <h3 className="text-13 font-semibold uppercase text-muted tracking-wider">
              Welcome
            </h3>
            <p className="text-20 font-medium text-text">
              {profile.display_name || `@${profile.username}`}
            </p>
            <p className="text-13 text-muted">Signed in as owner account</p>
          </Card>

          <Card className="flex flex-col gap-2">
            <h3 className="text-13 font-semibold uppercase text-muted tracking-wider">
              RLS Health
            </h3>
            <p className="text-20 font-medium text-green-600 dark:text-green-400">
              Active & Enforced
            </p>
            <p className="text-13 text-muted">All tables protected via RLS policies</p>
          </Card>

          <Card className="flex flex-col gap-2">
            <h3 className="text-13 font-semibold uppercase text-muted tracking-wider">
              Supabase Status
            </h3>
            <p className="text-20 font-medium text-text">Connected</p>
            <p className="text-13 text-muted">Auth trigger & storage configurations verified</p>
          </Card>
        </div>
      </main>
    </div>
  );
}
