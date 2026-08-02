import { env } from "@/lib/env";

/** Site origin (e.g. "https://example.com"), no trailing slash. */
export function getSiteUrl(): string {
  return env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
}

/** Bare domain/host (e.g. "example.com"), used for WebFinger acct: handles. */
export function getSiteDomain(): string {
  try {
    return new URL(getSiteUrl()).host;
  } catch {
    return "localhost";
  }
}

export function actorUrl(username: string): string {
  return `${getSiteUrl()}/users/${username}`;
}
