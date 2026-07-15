import type { Metadata } from "next";
import { Providers } from "./providers";
import { CommandPalette } from "@/components/ui/command-palette";
import "./globals.css";

export const metadata: Metadata = {
  title: "SaaS Blog",
  description: "Minimalist reading page & drawings",
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
        </Providers>
      </body>
    </html>
  );
}
