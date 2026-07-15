import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

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
