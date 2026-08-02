import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { sendWeeklyDigestEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Triggered by a scheduled job (see vercel.json) once a week. Sends every
 * post published in the last 7 days to newsletter subscribers.
 * Protected by CRON_SECRET — set it in your environment and Vercel will
 * automatically send it as a Bearer token for configured cron jobs; for
 * manual/other schedulers, pass ?secret=... or an Authorization header.
 */
export async function GET(request: Request) {
  if (env.CRON_SECRET) {
    const authHeader = request.headers.get("authorization");
    const { searchParams } = new URL(request.url);
    const providedSecret = authHeader?.replace("Bearer ", "") || searchParams.get("secret");

    if (providedSecret !== env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await sendWeeklyDigestEmail();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send weekly digest";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
