"use client";

import * as React from "react";

/**
 * Registers the offline-support service worker (public/sw.js). Renders
 * nothing; mount once near the root layout.
 */
export function ServiceWorkerRegister() {
  React.useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const handle = window.setTimeout(() => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Fail silently — offline support is a progressive enhancement
      });
    }, 1000);

    return () => window.clearTimeout(handle);
  }, []);

  return null;
}
