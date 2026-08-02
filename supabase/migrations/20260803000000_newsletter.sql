-- Newsletter subscription toggle + a security-definer helper to fetch
-- subscriber emails in bulk (auth.users emails aren't otherwise readable
-- client-side, same pattern as the existing get_user_email function).
alter table profiles add column if not exists newsletter_subscribed boolean not null default false;

create or replace function get_subscriber_emails()
returns table (id uuid, email text)
security definer stable as $$
  select p.id, u.email
  from profiles p
  join auth.users u on u.id = p.id
  where p.newsletter_subscribed = true and p.suspended_at is null;
$$ language sql;
