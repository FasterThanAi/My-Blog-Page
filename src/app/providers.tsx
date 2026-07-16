"use client";

import { ThemeProvider } from "next-themes";
import { ToastProvider } from "@/components/ui/toast";
import * as React from "react";

if (typeof window !== "undefined") {
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    const message = args.map(String).join(" ");
    if (message.includes("Failed to use workers for subsetting")) {
      console.warn("Excalidraw: Failed to use workers for subsetting, falling back to the main thread.");
      return;
    }
    originalError.apply(console, args);
  };
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <ToastProvider>{children}</ToastProvider>
    </ThemeProvider>
  );
}
