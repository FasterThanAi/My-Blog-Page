import { NextResponse } from "next/server";

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const content = `# SaaS Blog - Platform Context

SaaS Blog is a minimal reading and publishing platform built with Next.js, Supabase, TailwindCSS, and Excalidraw-powered canvas drawings.

## Key Sitemap Sections
- Home page: ${siteUrl}/ (Landing layout)
- Articles directory: ${siteUrl}/explore (Discover published content)
- Search portal: ${siteUrl}/search (Interactive query parsing)
- Bookmarked reads: ${siteUrl}/bookmarks (Reading list)

## Integration Capabilities
- **Tiptap Editor:** Custom nodes supporting inline excalidraw graphics.
- **Supabase Authentication:** Profile layout with customizable user settings.
- **RSC Actions API:** Secure server action structures parsing payload parameters.
`;

  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
