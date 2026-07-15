"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { AnalyticsChart } from "@/components/dashboard/analytics-chart";
import { BarChart3, ShieldAlert, Users, Sliders, BookOpen, MessageSquare, Heart } from "lucide-react";

interface StatItem {
  title: string;
  value: number;
  delta: number;
  icon: "users" | "posts" | "comments" | "reactions";
}

interface DashboardTabsProps {
  statItems: StatItem[];
  chartData: {
    date: string;
    signups: number;
    posts: number;
  }[];
  moderationQueue: React.ReactNode;
  usersDirectory: React.ReactNode;
  flagsManager: React.ReactNode;
}

export function DashboardTabs({
  statItems,
  chartData,
  moderationQueue,
  usersDirectory,
  flagsManager,
}: DashboardTabsProps) {
  const [activeTab, setActiveTab] = React.useState<"overview" | "moderation" | "users" | "flags">("overview");

  const tabOptions = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "moderation", label: "Moderation", icon: ShieldAlert },
    { id: "users", label: "Users", icon: Users },
    { id: "flags", label: "Feature Flags", icon: Sliders },
  ] as const;

  return (
    <div className="flex flex-col gap-8 w-full">
      {/* Horizontal Tabs Navigation */}
      <div className="flex items-center gap-1 bg-surface border border-border/60 p-1 rounded-16 w-fit select-none">
        {tabOptions.map((opt) => {
          const Icon = opt.icon;
          return (
            <button
              key={opt.id}
              onClick={() => setActiveTab(opt.id)}
              className={`flex items-center gap-2.5 px-4.5 py-2.5 rounded-12 text-13 font-semibold transition-all cursor-pointer focus-ring ${
                activeTab === opt.id
                  ? "bg-raised border border-border/80 text-text shadow-sm"
                  : "border border-transparent text-muted hover:text-text"
              }`}
            >
              <Icon className="w-4 h-4 stroke-[1.75]" />
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      {activeTab === "overview" && (
        <div className="flex flex-col gap-8 w-full">
          {/* Stat Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {statItems.map((item) => {
              const iconMap = {
                users: Users,
                posts: BookOpen,
                comments: MessageSquare,
                reactions: Heart,
              };
              const Icon = iconMap[item.icon];
              return (
                <Card
                  key={item.title}
                  className="p-5 flex justify-between items-start border border-border/60 hover:border-border transition-colors bg-surface select-none"
                >
                  <div className="flex flex-col gap-2">
                    <span className="text-11 font-semibold text-muted uppercase tracking-wider">
                      {item.title}
                    </span>
                    <span className="text-24 font-bold font-mono tracking-tight text-text">
                      {item.value}
                    </span>
                    <span className="text-11 text-green-600 bg-green-500/5 px-2 py-0.5 rounded border border-green-500/10 w-fit font-medium">
                      +{item.delta} this week
                    </span>
                  </div>
                  <div className="p-3 rounded-12 bg-accent/5 text-accent border border-accent/10">
                    <Icon className="w-5 h-5 stroke-[1.5]" />
                  </div>
                </Card>
              );
            })}
          </div>

          {/* SVG Analytics Chart Card */}
          <Card className="p-6 border border-border/60 bg-surface flex flex-col gap-5">
            <div className="flex flex-col select-none">
              <h3 className="text-15 font-semibold text-text">Activity Trends</h3>
              <p className="text-12 text-muted">Platform signup volume and post creations over the past 30 days.</p>
            </div>
            <AnalyticsChart chartData={chartData} />
          </Card>
        </div>
      )}

      {activeTab === "moderation" && moderationQueue}

      {activeTab === "users" && usersDirectory}

      {activeTab === "flags" && flagsManager}
    </div>
  );
}
