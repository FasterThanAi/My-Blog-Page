"use client";

import * as React from "react";
import { toggleFeatureFlagAction } from "@/app/actions/dashboard";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { ToggleLeft, ToggleRight, Sparkles, MessageSquare, UserPlus } from "lucide-react";

interface FeatureFlag {
  key: string;
  enabled: boolean;
  description: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function FlagsManager() {
  const supabase = createClient();
  const { toast } = useToast();
  const [flags, setFlags] = React.useState<Record<string, boolean>>({
    ai_assistant: true,
    comments: true,
    public_signup: true,
  });
  const [loading, setLoading] = React.useState(true);
  const [togglingKey, setTogglingKey] = React.useState<string | null>(null);

  const loadFlags = React.useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("feature_flags")
        .select("key, enabled");

      if (!error && data) {
        const flagMap: Record<string, boolean> = {};
        data.forEach((flag) => {
          flagMap[flag.key] = flag.enabled;
        });
        setFlags((prev) => ({ ...prev, ...flagMap }));
      }
    } catch {
      toast("Failed to load feature flags settings", "error");
    } finally {
      setLoading(false);
    }
  }, [supabase, toast]);

  React.useEffect(() => {
    const handle = requestAnimationFrame(() => {
      loadFlags();
    });
    return () => cancelAnimationFrame(handle);
  }, [loadFlags]);

  const handleToggle = async (key: string, currentVal: boolean) => {
    setTogglingKey(key);
    try {
      const res = await toggleFeatureFlagAction({
        flagKey: key,
        enabled: !currentVal,
      });

      if (res.success) {
        setFlags((prev) => ({ ...prev, [key]: !currentVal }));
        toast(`Feature flag "${key}" updated successfully`, "success");
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to toggle flag", "error");
    } finally {
      setTogglingKey(null);
    }
  };

  const flagConfigs: FeatureFlag[] = [
    {
      key: "ai_assistant",
      title: "AI Writing Assistant",
      description: "Enables Gemini 3.1 Flash Lite copywriting options, alt tag description builders, and autocomplete suggestions inside the TiPTap editor canvas.",
      icon: Sparkles,
      enabled: flags.ai_assistant,
    },
    {
      key: "comments",
      title: "Public Comments & Threads",
      description: "Controls the discussion thread interface under published posts. Disabling this hides comment blocks platform-wide.",
      icon: MessageSquare,
      enabled: flags.comments,
    },
    {
      key: "public_signup",
      title: "Public Signups",
      description: "Enables open user registration. Disabling this converts the /auth/sign-up view into an invite-only notice.",
      icon: UserPlus,
      enabled: flags.public_signup,
    },
  ];

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-5 flex justify-between items-center animate-pulse bg-surface">
            <div className="flex gap-4 items-center">
              <div className="w-10 h-10 bg-border/20 rounded-12" />
              <div className="flex flex-col gap-2">
                <div className="w-32 h-4 bg-border/20 rounded" />
                <div className="w-64 h-3 bg-border/10 rounded" />
              </div>
            </div>
            <div className="w-12 h-6 bg-border/20 rounded" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      {flagConfigs.map((flag) => {
        const IconComponent = flag.icon;
        const isToggling = togglingKey === flag.key;

        return (
          <Card
            key={flag.key}
            className="p-5 flex justify-between items-start gap-6 border border-border/60 hover:border-border transition-colors bg-surface select-none"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-12 bg-accent/5 text-accent border border-accent/10 mt-0.5">
                <IconComponent className="w-5 h-5" />
              </div>
              <div className="flex flex-col gap-1">
                <h4 className="text-15 font-semibold text-text">{flag.title}</h4>
                <p className="text-13 text-muted leading-relaxed max-w-xl">
                  {flag.description}
                </p>
              </div>
            </div>

            {/* Toggle Icon switch */}
            <button
              onClick={() => handleToggle(flag.key, flag.enabled)}
              disabled={isToggling}
              className={`p-1 rounded-12 hover:bg-border/20 text-muted hover:text-text cursor-pointer transition-colors focus-ring ${
                isToggling ? "opacity-50 cursor-not-allowed" : ""
              }`}
              aria-label={`Toggle ${flag.title}`}
            >
              {flag.enabled ? (
                <ToggleRight className="w-10 h-10 text-accent stroke-[1.25]" />
              ) : (
                <ToggleLeft className="w-10 h-10 text-muted stroke-[1.25]" />
              )}
            </button>
          </Card>
        );
      })}
    </div>
  );
}
