-- Subscriber referral rewards: every profile's username doubles as their
-- referral code (?ref=username on the sign-up page). Successful referrals
-- are recorded by extending the existing handle_new_user() trigger to read
-- a referral_code passed through auth signUp's raw_user_meta_data.
create table referrals (
  referred_id uuid primary key references profiles(id) on delete cascade,
  referrer_id uuid references profiles(id) not null,
  created_at timestamptz not null default now(),
  check (referrer_id <> referred_id)
);

create index referrals_referrer_idx on referrals (referrer_id);

alter table referrals enable row level security;

-- Readable by anyone (referral counts/badges are public, like follower counts).
-- No insert policy: rows are only ever created by the security-definer
-- handle_new_user() trigger below, never directly by a client.
create policy "Select referrals" on referrals for select using (true);

create or replace function public.handle_new_user()
returns trigger as $$
declare
  new_username text;
  base_username text;
  suffix int := 1;
  ref_code text;
  referrer_profile_id uuid;
begin
  base_username := lower(regexp_replace(split_part(new.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g'));
  if length(base_username) < 3 then
    base_username := base_username || 'usr';
  end if;
  base_username := substring(base_username from 1 for 20);
  new_username := base_username;
  while exists(select 1 from public.profiles where username = new_username) loop
    new_username := base_username || suffix::text;
    suffix := suffix + 1;
  end loop;

  insert into public.profiles (id, role, username, display_name, avatar_url, bio, ai_assistant_enabled, theme_preference)
  values (
    new.id,
    'customer',
    new_username,
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    null,
    true,
    'system'
  );

  -- Record a referral if a valid referral_code (referrer's username) was passed at signup
  ref_code := new.raw_user_meta_data->>'referral_code';
  if ref_code is not null and length(ref_code) > 0 then
    select id into referrer_profile_id from public.profiles where username = lower(ref_code);
    if referrer_profile_id is not null and referrer_profile_id <> new.id then
      insert into public.referrals (referred_id, referrer_id) values (new.id, referrer_profile_id)
      on conflict (referred_id) do nothing;
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer;
