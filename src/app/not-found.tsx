"use client";

import * as React from "react";
import Link from "next/link";
import { GlassNav } from "@/components/ui/glass-nav";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <GlassNav />

      <main className="flex-1 flex flex-col justify-center items-center px-6">
        <EmptyState
          icon={AlertCircle}
          title="Page not found"
          description="The page you are looking for doesn't exist, has been moved, or is no longer available."
          action={
            <Link href="/">
              <Button size="sm">Go back home</Button>
            </Link>
          }
        />
      </main>
    </div>
  );
}
