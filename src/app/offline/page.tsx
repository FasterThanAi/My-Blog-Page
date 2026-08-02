import Link from "next/link";
import { WifiOff } from "lucide-react";

export const metadata = {
  title: "You're offline | SaaS Blog",
};

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6 text-center select-none">
      <WifiOff className="w-10 h-10 text-muted mb-4" />
      <h1 className="text-24 font-black text-text mb-2">You&apos;re offline</h1>
      <p className="text-15 text-muted max-w-sm mb-6">
        This page hasn&apos;t been saved for offline reading yet. Articles you&apos;ve already
        opened or bookmarked will still work without a connection.
      </p>
      <Link
        href="/"
        className="inline-flex items-center border-2 border-border px-4 py-2 text-13 font-bold text-text hover:border-accent hover:text-accent transition-colors"
      >
        Back home
      </Link>
    </div>
  );
}
