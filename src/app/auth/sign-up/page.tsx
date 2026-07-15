"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { Lock } from "lucide-react";

function SignUpForm() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [publicSignup, setPublicSignup] = React.useState(true);
  const [checkingFlag, setCheckingFlag] = React.useState(true);
  const returnTo = searchParams.get("returnTo") ?? "/";

  React.useEffect(() => {
    const checkFlag = async () => {
      try {
        const { data } = await supabase
          .from("feature_flags")
          .select("enabled")
          .eq("key", "public_signup")
          .maybeSingle();
        if (data) {
          setPublicSignup(data.enabled);
        }
      } catch {
        // Fallback to true
      } finally {
        setCheckingFlag(false);
      }
    };
    checkFlag();
  }, [supabase]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast("Please fill in all fields", "error");
      return;
    }
    if (password.length < 6) {
      toast("Password must be at least 6 characters", "error");
      return;
    }
    setLoading(true);
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(returnTo)}`,
      },
    });
    setLoading(false);

    if (error) {
      toast(error.message, "error");
    } else {
      if (data?.session) {
        toast("Registration successful!", "success");
        router.push(returnTo);
        router.refresh();
      } else {
        toast("Please check your email for the confirmation link.", "info");
      }
    }
  };

  const handleGoogleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(returnTo)}`,
      },
    });
    if (error) {
      toast(error.message, "error");
    }
  };

  if (checkingFlag) {
    return (
      <Card className="w-full max-w-[400px] p-8 flex flex-col gap-6 animate-pulse bg-surface">
        <div className="h-8 bg-border/20 rounded-8 w-1/2 mx-auto" />
        <div className="h-4 bg-border/20 rounded-8 w-3/4 mx-auto" />
        <div className="h-10 bg-border/20 rounded-12 mt-4" />
        <div className="h-10 bg-border/20 rounded-12" />
        <div className="h-10 bg-border/20 rounded-12 mt-2" />
      </Card>
    );
  }

  if (!publicSignup) {
    return (
      <Card className="w-full max-w-[400px] p-8 flex flex-col gap-6 shadow-sm text-center bg-surface border border-border/60">
        <div className="flex flex-col gap-3.5 items-center select-none">
          <div className="p-3.5 rounded-full bg-red-500/5 text-red-500 border border-red-500/10 mb-1">
            <Lock className="w-6 h-6 stroke-[1.5]" />
          </div>
          <h1 className="text-20 font-bold tracking-tight text-text">Invite-Only Access</h1>
          <p className="text-13 text-muted leading-relaxed">
            Registration is currently closed to the public. If you received an invitation or have a referral code, please contact your administrator to set up your account.
          </p>
        </div>
        <div className="border-t border-border/40 pt-4 mt-2 select-none">
          <Link href="/" className="text-13 text-accent hover:underline font-medium">
            Return to Home
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-[400px] p-8 flex flex-col gap-6 shadow-sm">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-24 font-semibold tracking-tight text-text">Create an account</h1>
        <p className="text-13 text-muted">
          Enter your email and choose a password to register
        </p>
      </div>

      <form onSubmit={handleSignUp} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-13 font-medium text-text">Email</label>
          <Input
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-13 font-medium text-text">Password</label>
          <Input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            required
          />
        </div>

        <Button type="submit" className="w-full mt-2" disabled={loading}>
          {loading ? "Registering..." : "Sign Up"}
        </Button>
      </form>

      <div className="relative flex items-center justify-center">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <span className="relative px-3 bg-surface text-13 text-muted">
          or continue with
        </span>
      </div>

      <Button
        variant="secondary"
        onClick={handleGoogleSignIn}
        className="w-full flex items-center justify-center gap-2"
        disabled={loading}
      >
        <svg className="w-4 h-4 mr-1 shrink-0" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Google
      </Button>

      <p className="text-13 text-center text-muted">
        Already have an account?{" "}
        <Link
          href={`/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`}
          className="text-accent hover:underline font-medium"
        >
          Sign in
        </Link>
      </p>
    </Card>
  );
}

export default function SignUpPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6 bg-bg">
      <React.Suspense fallback={
        <Card className="w-full max-w-[400px] p-8 flex flex-col gap-6 animate-pulse">
          <div className="h-8 bg-border/20 rounded-8 w-1/2 mx-auto" />
          <div className="h-4 bg-border/20 rounded-8 w-3/4 mx-auto" />
          <div className="h-10 bg-border/20 rounded-12 mt-4" />
          <div className="h-10 bg-border/20 rounded-12" />
          <div className="h-10 bg-border/20 rounded-12 mt-2" />
        </Card>
      }>
        <SignUpForm />
      </React.Suspense>
    </div>
  );
}
