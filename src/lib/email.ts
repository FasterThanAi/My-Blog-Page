import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function sendNotificationEmail({
  recipientId,
  actorName,
  eventType,
  postTitle,
  commentBody,
}: {
  recipientId: string;
  actorName: string;
  eventType: "reply" | "follow";
  postTitle?: string;
  commentBody?: string;
}) {
  if (!env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY is not defined. Skipping email notification.");
    return;
  }

  // Create standard supabase server client
  const supabase = await createClient();

  // 1. Fetch recipient profile and check settings
  const { data: recipient, error: recipientError } = await supabase
    .from("profiles")
    .select("email_notifications")
    .eq("id", recipientId)
    .single();

  if (recipientError || !recipient || !recipient.email_notifications) {
    return;
  }

  // 2. Fetch recipient email from auth.users using get_user_email function
  const { data: recipientEmail, error: emailError } = await supabase
    .rpc("get_user_email", { user_id: recipientId });

  if (emailError || !recipientEmail) {
    console.error("Failed to fetch recipient email:", emailError);
    return;
  }

  // 3. Batch-guard check: max 1 email per event type per hour per user
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: recentLogs, error: logCheckError } = await supabase
    .from("email_logs")
    .select("id")
    .eq("user_id", recipientId)
    .eq("event_type", eventType)
    .gte("sent_at", oneHourAgo);

  if (logCheckError) {
    console.error("Failed to check email logs:", logCheckError);
    return;
  }

  if (recentLogs && recentLogs.length > 0) {
    // Already sent an email for this event type within the last hour
    return;
  }

  // 4. Log this email before sending
  const { error: insertLogError } = await supabase
    .from("email_logs")
    .insert({
      user_id: recipientId,
      event_type: eventType,
    });

  if (insertLogError) {
    console.error("Failed to log sent email:", insertLogError);
    return;
  }

  // 5. Send email via Resend REST API
  let subject = "";
  let html = "";

  if (eventType === "follow") {
    subject = `${actorName} followed you on SaaS Blog`;
    html = `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #111113; background-color: #FAFAFA; border: 1px solid rgba(0,0,0,0.07); border-radius: 16px;">
        <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 16px;">New Follower</h2>
        <p style="font-size: 15px; line-height: 1.6; color: #6B6B70;">
          <strong>${actorName}</strong> is now following you on SaaS Blog.
        </p>
        <hr style="border: none; border-top: 1px solid rgba(0,0,0,0.07); margin: 24px 0;" />
        <p style="font-size: 13px; color: #8E8E95; margin: 0;">
          You are receiving this because you enabled email notifications. You can turn them off in your Settings page.
        </p>
      </div>
    `;
  } else if (eventType === "reply") {
    subject = `${actorName} replied to your comment`;
    html = `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #111113; background-color: #FAFAFA; border: 1px solid rgba(0,0,0,0.07); border-radius: 16px;">
        <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 16px;">New Reply</h2>
        <p style="font-size: 15px; line-height: 1.6; color: #6B6B70;">
          <strong>${actorName}</strong> replied to your comment on <strong>${postTitle || "your post"}</strong>:
        </p>
        <blockquote style="border-left: 3px solid #0A84FF; margin: 16px 0; padding-left: 16px; color: #111113; font-style: italic; font-size: 15px;">
          "${commentBody || ""}"
        </blockquote>
        <hr style="border: none; border-top: 1px solid rgba(0,0,0,0.07); margin: 24px 0;" />
        <p style="font-size: 13px; color: #8E8E95; margin: 0;">
          You are receiving this because you enabled email notifications. You can turn them off in your Settings page.
        </p>
      </div>
    `;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "onboarding@resend.dev",
        to: recipientEmail,
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Resend API failed to send email:", errorText);
    }
  } catch (err) {
    console.error("Error sending notification email via Resend:", err);
  }
}

interface SubscriberRow {
  id: string;
  email: string;
}

/**
 * Fetches all newsletter-subscribed profiles + their emails via the
 * get_subscriber_emails security-definer RPC (auth.users emails aren't
 * otherwise readable client/server-side outside RLS).
 */
export async function getNewsletterSubscribers(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>
): Promise<SubscriberRow[]> {
  const { data, error } = await supabase.rpc("get_subscriber_emails");
  if (error) {
    console.error("Failed to fetch newsletter subscribers:", error);
    return [];
  }
  return (data || []) as SubscriberRow[];
}

/** Raw Resend send, shared by the newsletter/digest senders below. */
async function sendRawEmail(to: string, subject: string, html: string) {
  if (!env.RESEND_API_KEY) return;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: "onboarding@resend.dev", to, subject, html }),
    });
    if (!res.ok) {
      console.error("Resend API failed to send email:", await res.text());
    }
  } catch (err) {
    console.error("Error sending email via Resend:", err);
  }
}

const EMAIL_WRAPPER_STYLE =
  "font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #201E1D; background-color: #E2E0DE; border: 2px solid #201E1D;";

/**
 * Sends a single freshly-published post to every newsletter subscriber
 * (Ghost-style "post = newsletter"). Fire-and-forget from the caller.
 */
export async function sendPostNewsletterEmail(post: {
  id: string;
  title: string;
  excerpt: string | null;
  slug: string | null;
  authorName: string;
}) {
  const supabase = await createClient();
  const subscribers = await getNewsletterSubscribers(supabase);
  if (subscribers.length === 0) return;

  const siteUrl = env.NEXT_PUBLIC_SITE_URL;
  const postUrl = `${siteUrl}/post/${post.slug || post.id}`;
  const subject = `New post: ${post.title}`;
  const html = `
    <div style="${EMAIL_WRAPPER_STYLE}">
      <p style="font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #EC3013; margin: 0 0 12px;">New Post</p>
      <h2 style="font-size: 24px; font-weight: 800; margin: 0 0 12px;">${post.title}</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #726F6C; margin: 0 0 20px;">${post.excerpt || ""}</p>
      <a href="${postUrl}" style="display: inline-block; background: #EC3013; color: #fff; font-weight: 700; font-size: 13px; padding: 10px 18px; text-decoration: none;">Read it now</a>
      <hr style="border: none; border-top: 1px solid rgba(32,30,29,0.2); margin: 24px 0;" />
      <p style="font-size: 12px; color: #726F6C; margin: 0;">
        By ${post.authorName} · You're receiving this because you subscribed to the newsletter. Manage this in Settings.
      </p>
    </div>
  `;

  await Promise.all(subscribers.map((s) => sendRawEmail(s.email, subject, html)));
}

/**
 * Sends a weekly digest of everything published in the last 7 days to
 * every newsletter subscriber. Meant to be triggered by a scheduled job
 * (see /api/cron/weekly-digest).
 */
export async function sendWeeklyDigestEmail() {
  const supabase = await createClient();
  const subscribers = await getNewsletterSubscribers(supabase);
  if (subscribers.length === 0) return { sent: 0, posts: 0 };

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: posts } = await supabase
    .from("posts")
    .select("id, title, excerpt, slug, profiles!author_id(display_name, username)")
    .eq("status", "published")
    .eq("visibility", "public")
    .eq("is_hidden", false)
    .gte("published_at", sevenDaysAgo)
    .order("published_at", { ascending: false })
    .limit(10);

  if (!posts || posts.length === 0) return { sent: 0, posts: 0 };

  const siteUrl = env.NEXT_PUBLIC_SITE_URL;
  const itemsHtml = posts
    .map((p) => {
      const postUrl = `${siteUrl}/post/${p.slug || p.id}`;
      const authorProfile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
      const author = authorProfile?.display_name || authorProfile?.username || "Anonymous";
      return `
        <div style="padding: 16px 0; border-bottom: 1px solid rgba(32,30,29,0.15);">
          <a href="${postUrl}" style="font-size: 17px; font-weight: 700; color: #201E1D; text-decoration: none;">${p.title || "Untitled"}</a>
          <p style="font-size: 13px; color: #726F6C; margin: 6px 0 0;">${p.excerpt || ""}</p>
          <p style="font-size: 11px; color: #726F6C; margin: 6px 0 0;">By ${author}</p>
        </div>
      `;
    })
    .join("");

  const subject = `Your weekly digest: ${posts.length} new post${posts.length === 1 ? "" : "s"}`;
  const html = `
    <div style="${EMAIL_WRAPPER_STYLE}">
      <p style="font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #EC3013; margin: 0 0 12px;">Weekly Digest</p>
      ${itemsHtml}
      <p style="font-size: 12px; color: #726F6C; margin: 20px 0 0;">
        You're receiving this because you subscribed to the newsletter. Manage this in Settings.
      </p>
    </div>
  `;

  await Promise.all(subscribers.map((s) => sendRawEmail(s.email, subject, html)));
  return { sent: subscribers.length, posts: posts.length };
}
