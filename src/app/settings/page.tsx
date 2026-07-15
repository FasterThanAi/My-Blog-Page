"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { GlassNav } from "@/components/ui/glass-nav";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Camera, Save } from "lucide-react";

// Validate inputs matching the database constraints
const settingsSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(24, "Username must be at most 24 characters")
    .regex(/^[a-z0-9_]{3,24}$/, "Username must contain only lowercase letters, numbers, and underscores"),
  display_name: z.string().max(50, "Display name must be at most 50 characters").optional().nullable(),
  bio: z.string().max(500, "Bio must be at most 500 characters").optional().nullable(),
  website_url: z.string().url("Must be a valid URL").or(z.literal("")).optional().nullable(),
  ai_assistant_enabled: z.boolean(),
  theme_preference: z.enum(["light", "dark", "system"]),
  email_notifications: z.boolean(),
});

export default function SettingsPage() {
  const supabase = createClient();
  const router = useRouter();
  const { toast } = useToast();
  const { setTheme } = useTheme();

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [userId, setUserId] = React.useState<string | null>(null);

  // Form states
  const [username, setUsername] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [bio, setBio] = React.useState("");
  const [websiteUrl, setWebsiteUrl] = React.useState("");
  const [aiEnabled, setAiEnabled] = React.useState(true);
  const [themePreference, setThemePreference] = React.useState<"light" | "dark" | "system">("system");
  const [emailNotifications, setEmailNotifications] = React.useState(true);
  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = React.useState(false);

  React.useEffect(() => {
    async function loadData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth/sign-in?returnTo=/settings");
        return;
      }

      setUserId(user.id);

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (!error && profile) {
        setUsername(profile.username);
        setDisplayName(profile.display_name || "");
        setBio(profile.bio || "");
        setWebsiteUrl(profile.website_url || "");
        setAiEnabled(profile.ai_assistant_enabled);
        setThemePreference(profile.theme_preference as "light" | "dark" | "system");
        setEmailNotifications(profile.email_notifications ?? true);
        setAvatarUrl(profile.avatar_url);
      }
      setLoading(false);
    }

    loadData();
  }, [supabase, router]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !userId) return;
    const file = e.target.files[0];
    const fileExt = file.name.split(".").pop();
    const fileName = `${userId}-${Date.now()}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    setUploadingAvatar(true);
    try {
      // 1. List existing files in user's folder to delete (prevents orphaning)
      const { data: existingFiles } = await supabase.storage
        .from("avatars")
        .list(userId);

      if (existingFiles && existingFiles.length > 0) {
        const pathsToRemove = existingFiles.map((f) => `${userId}/${f.name}`);
        await supabase.storage.from("avatars").remove(pathsToRemove);
      }

      // 2. Upload new avatar
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 3. Get public URL
      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const publicUrl = data.publicUrl;

      // 4. Update state and local profile avatar immediately
      setAvatarUrl(publicUrl);
      
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", userId);

      if (updateError) throw updateError;

      toast("Avatar updated successfully", "success");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to upload avatar";
      toast(message, "error");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    // Validate using Zod
    const validation = settingsSchema.safeParse({
      username,
      display_name: displayName || null,
      bio: bio || null,
      website_url: websiteUrl || null,
      ai_assistant_enabled: aiEnabled,
      theme_preference: themePreference,
      email_notifications: emailNotifications,
    });

    if (!validation.success) {
      toast(validation.error.issues[0].message, "error");
      return;
    }

    setSaving(true);

    try {
      // Check username uniqueness
      const { data: existingUser } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username)
        .neq("id", userId)
        .maybeSingle();

      if (existingUser) {
        toast("Username is already taken", "error");
        setSaving(false);
        return;
      }

      // Save profile changes
      const { error } = await supabase
        .from("profiles")
        .update({
          username,
          display_name: displayName || null,
          bio: bio || null,
          website_url: websiteUrl || null,
          ai_assistant_enabled: aiEnabled,
          theme_preference: themePreference,
          email_notifications: emailNotifications,
        })
        .eq("id", userId);

      if (error) throw error;

      // Apply theme preference to theme context instantly
      setTheme(themePreference);

      toast("Settings saved successfully", "success");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save settings";
      toast(message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg">
      <GlassNav />

      <main className="mx-auto max-w-[640px] px-6 py-12 flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-32 font-semibold tracking-tight text-text">Settings</h1>
          <p className="text-15 text-muted">
            Manage your profile details, theme settings, and preferences.
          </p>
        </div>

        {loading ? (
          <Card className="flex flex-col gap-6 animate-pulse">
            <div className="flex items-center gap-4">
              <Skeleton className="w-16 h-16 rounded-full" />
              <div className="flex flex-col gap-2 flex-1">
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-4 w-1/4" />
              </div>
            </div>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-10 w-full" />
          </Card>
        ) : (
          <form onSubmit={handleSave} className="flex flex-col gap-6">
            {/* Avatar Section */}
            <Card className="flex items-center gap-6 p-6">
              <div className="relative group">
                <Avatar src={avatarUrl} fallback={displayName || username} size="lg" />
                <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity focus-ring">
                  <Camera className="w-6 h-6 text-white" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                    disabled={uploadingAvatar}
                  />
                </label>
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <h3 className="text-17 font-semibold text-text">Profile Picture</h3>
                <p className="text-13 text-muted">
                  {uploadingAvatar ? "Uploading picture..." : "Click image to upload avatar"}
                </p>
              </div>
            </Card>

            {/* Form Fields Card */}
            <Card className="flex flex-col gap-6 p-6">
              <div className="flex flex-col gap-1.5">
                <label className="text-13 font-semibold text-text">Username</label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  placeholder="username"
                  required
                />
                <p className="text-13 text-muted">
                  3 to 24 characters. Lowercase letters, numbers, and underscores only.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-13 font-semibold text-text">Display Name</label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your Name"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-13 font-semibold text-text">Bio</label>
                <Textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Write a short bio..."
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-13 font-semibold text-text">Website URL</label>
                <Input
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://yourwebsite.com"
                />
              </div>
            </Card>

            {/* Preferences Card */}
            <Card className="flex flex-col gap-6 p-6">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <h3 className="text-15 font-semibold text-text">AI Assistant</h3>
                  <p className="text-13 text-muted">
                    Enable writing assistant features throughout the app.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={aiEnabled}
                  onChange={(e) => setAiEnabled(e.target.checked)}
                  className="w-5 h-5 rounded-md border-border accent-accent cursor-pointer focus-ring"
                />
              </div>
              
              <div className="flex items-center justify-between border-t border-border/40 pt-4">
                <div className="flex flex-col gap-0.5">
                  <h3 className="text-15 font-semibold text-text">Email Notifications</h3>
                  <p className="text-13 text-muted">
                    Receive emails when someone follows you or replies to your comments.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={emailNotifications}
                  onChange={(e) => setEmailNotifications(e.target.checked)}
                  className="w-5 h-5 rounded-md border-border accent-accent cursor-pointer focus-ring"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-13 font-semibold text-text">Theme Preference</label>
                <select
                  value={themePreference}
                  onChange={(e) => setThemePreference(e.target.value as "light" | "dark" | "system")}
                  className="h-[44px] px-4 rounded-12 bg-surface border border-border text-text text-15 outline-none cursor-pointer focus-ring"
                >
                  <option value="system">System Default</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>
            </Card>

            <Button type="submit" className="w-full flex items-center justify-center gap-2 mt-2" disabled={saving}>
              <Save className="w-4 h-4" />
              {saving ? "Saving Changes..." : "Save Settings"}
            </Button>
          </form>
        )}
      </main>
    </div>
  );
}
