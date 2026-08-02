import type { Metadata, Viewport } from "next";
import { Providers } from "./providers";
import { CommandPalette } from "@/components/ui/command-palette";
import { ServiceWorkerRegister } from "@/components/ui/sw-register";
import { AskArchiveWidget } from "@/components/ui/ask-archive-widget";
import "./globals.css";

export const metadata: Metadata = {
  title: "SaaS Blog",
  description: "Minimalist reading page & drawings",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SaaS Blog",
  },
};

export const viewport: Viewport = {
  themeColor: "#201E1D",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-bg text-text font-sans antialiased">
        <Providers>
          {children}
          <CommandPalette />
          <ServiceWorkerRegister />
          <AskArchiveWidget />
        </Providers>
      </body>
    </html>
  );
}
