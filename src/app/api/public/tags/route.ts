import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * Public, read-only Content API — GET /api/public/tags
 * Lists all tags. Small, unauthenticated, cheap enough to skip rate limiting.
 */
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("tags").select("name, slug").order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });
  }

  return NextResponse.json({ data: data || [] }, { headers: CORS_HEADERS });
}
