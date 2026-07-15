"use client";

import * as React from "react";
import { GlassNav } from "@/components/ui/glass-nav";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <GlassNav />

      <main className="flex-1 flex flex-col justify-center items-center px-6">
        <EmptyState
          icon={AlertTriangle}
          title="Something went wrong"
          description="An unexpected application error occurred while executing this command."
          action={
            <Button size="sm" onClick={reset} className="cursor-pointer">
              Reload page
            </Button>
          }
        />
      </main>
    </div>
  );
}
