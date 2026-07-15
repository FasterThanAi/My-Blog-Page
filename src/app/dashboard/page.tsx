import * as React from "react";
import { redirect } from "next/navigation";
import { verifyOwnerAccess, fetchDashboardAnalytics } from "@/app/actions/dashboard";
import { GlassNav } from "@/components/ui/glass-nav";
import { ModerationQueue } from "@/components/dashboard/moderation-queue";
import { UsersDirectory } from "@/components/dashboard/users-directory";
import { FlagsManager } from "@/components/dashboard/flags-manager";
import { Shield } from "lucide-react";
import { DashboardTabs } from "@/app/dashboard/dashboard-tabs";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Validate owner role on page load
  try {
    await verifyOwnerAccess();
  } catch {
    redirect("/");
  }

  // Load analytics
  const analytics = await fetchDashboardAnalytics();

  const statItems = [
    {
      title: "Total Users",
      value: analytics.stats.users.total,
      delta: analytics.stats.users.delta,
      icon: "users" as const,
    },
    {
      title: "Published Posts",
      value: analytics.stats.posts.total,
      delta: analytics.stats.posts.delta,
      icon: "posts" as const,
    },
    {
      title: "Active Comments",
      value: analytics.stats.comments.total,
      delta: analytics.stats.comments.delta,
      icon: "comments" as const,
    },
    {
      title: "Reactions",
      value: analytics.stats.reactions.total,
      delta: analytics.stats.reactions.delta,
      icon: "reactions" as const,
    },
  ];

  return (
    <div className="min-h-screen bg-bg text-text pb-20">
      <GlassNav />

      <main className="mx-auto max-w-7xl px-6 pt-10 flex flex-col gap-10">
        {/* Title */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-12 bg-accent/5 text-accent border border-accent/10">
            <Shield className="w-6 h-6 stroke-[1.5]" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-24 font-bold tracking-tight">Platform Operations</h1>
            <p className="text-13 text-muted">Owner operations center, analytics, moderation, and flags.</p>
          </div>
        </div>

        {/* Dashboard Tabs Switcher */}
        <DashboardTabs
          statItems={statItems}
          chartData={analytics.chartData}
          moderationQueue={<ModerationQueue />}
          usersDirectory={<UsersDirectory />}
          flagsManager={<FlagsManager />}
        />
      </main>
    </div>
  );
}
