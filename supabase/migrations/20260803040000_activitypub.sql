-- Fediverse follow (ActivityPub): lets Mastodon/Threads users follow an
-- author's profile directly, no account on this platform required.
--
-- activitypub_keys stores each author's RSA keypair used to sign outgoing
-- activities (required by the spec so remote servers can verify a message
-- really came from this actor). RLS is enabled with NO policies at all —
-- meaning it's completely inaccessible to the anon/authenticated roles and
-- only reachable via the service-role key (see src/lib/supabase/service.ts),
-- used exclusively by the ActivityPub server routes.
create table activitypub_keys (
  profile_id uuid primary key references profiles(id) on delete cascade,
  private_key_pem text not null,
  public_key_pem text not null,
  created_at timestamptz not null default now()
);

alter table activitypub_keys enable row level security;
-- Intentionally no policies — deny-all for anon/authenticated by default.

-- activitypub_followers tracks remote (fediverse) followers per author.
-- Follower actor URLs are not sensitive, so a public select policy is fine
-- (used to show a follower count on profiles); writes are service-role only.
create table activitypub_followers (
  profile_id uuid references profiles(id) on delete cascade not null,
  follower_actor_url text not null,
  follower_inbox_url text not null,
  created_at timestamptz not null default now(),
  primary key (profile_id, follower_actor_url)
);

create index activitypub_followers_profile_idx on activitypub_followers (profile_id);

alter table activitypub_followers enable row level security;
create policy "Select activitypub followers" on activitypub_followers for select using (true);
-- No insert/update/delete policy — service-role only.
