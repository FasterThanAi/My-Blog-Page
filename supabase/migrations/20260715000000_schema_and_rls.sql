-- Create custom types and enums
create type user_role as enum ('owner', 'customer');
create type post_status as enum ('draft', 'published', 'archived');
create type post_visibility as enum ('public', 'private', 'unlisted');

-- 1. Profiles Table
create table profiles (
  id uuid references auth.users primary key,
  role user_role not null default 'customer',
  username text unique not null check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text,
  avatar_url text,
  bio text,
  website_url text,
  ai_assistant_enabled boolean not null default true,
  theme_preference text not null default 'system',
  created_at timestamptz default now()
);

-- 2. Posts Table
create table posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references profiles(id) not null,
  title text not null default '',
  slug text unique,
  content jsonb not null default '{}',
  cover_image_url text,
  excerpt text,
  status post_status not null default 'draft',
  visibility post_visibility not null default 'public',
  reading_time_minutes int,
  seo_title text,
  seo_description text,
  view_count bigint not null default 0,
  published_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Drawings Table
create table drawings (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade,
  author_id uuid references profiles(id) not null,
  scene jsonb not null,
  preview_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 4. Comments Table
create table comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade not null,
  parent_id uuid references comments(id) on delete cascade,
  author_id uuid references profiles(id) not null,
  body text not null check (char_length(body) between 1 and 10000),
  is_deleted boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 5. Comment Votes Table
create table comment_votes (
  comment_id uuid references comments(id) on delete cascade,
  user_id uuid references profiles(id),
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz default now(),
  primary key (comment_id, user_id)
);

-- 6. Reactions Table
create table reactions (
  post_id uuid references posts(id) on delete cascade,
  user_id uuid references profiles(id),
  type text not null default 'like',
  primary key (post_id, user_id, type)
);

-- 7. Follows Table
create table follows (
  follower_id uuid references profiles(id),
  following_id uuid references profiles(id),
  created_at timestamptz default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

-- 8. Bookmarks Table
create table bookmarks (
  user_id uuid references profiles(id),
  post_id uuid references posts(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, post_id)
);

-- 9. Tags Table
create table tags (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  slug text unique not null
);

-- 10. Post Tags Table
create table post_tags (
  post_id uuid references posts(id) on delete cascade,
  tag_id uuid references tags(id) on delete cascade,
  primary key (post_id, tag_id)
);

-- 11. Notifications Table
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) not null,
  actor_id uuid references profiles(id),
  type text not null,
  post_id uuid references posts(id) on delete cascade,
  comment_id uuid references comments(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz default now()
);

-- 12. Reports Table
create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references profiles(id) not null,
  post_id uuid references posts(id) on delete cascade,
  comment_id uuid references comments(id) on delete cascade,
  reason text not null,
  status text not null default 'open',
  created_at timestamptz default now()
);

-- 13. Feature Flags Table
create table feature_flags (
  key text primary key,
  enabled boolean not null default true,
  updated_at timestamptz default now()
);

-- Full-text search and Indexes
alter table posts add column search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title,'')), 'A') ||
    setweight(to_tsvector('english', coalesce(excerpt,'')), 'B')
  ) stored;

create index posts_search_idx on posts using gin (search_vector);
create index comments_post_idx on comments (post_id, parent_id);
create index posts_feed_idx on posts (status, visibility, published_at desc);

-- Seed feature flags
insert into feature_flags (key, enabled) values
  ('ai_assistant', true),
  ('comments', true),
  ('public_signup', true)
on conflict (key) do update set enabled = excluded.enabled;

-- Helper role checking function to prevent complex joins in policies
create or replace function public.get_my_role()
returns public.user_role as $$
  select role from public.profiles where id = auth.uid();
$$ language sql security definer stable;

-- Trigger to sync user signups with Profiles
create or replace function public.handle_new_user()
returns trigger as $$
declare
  new_username text;
  base_username text;
  suffix int := 1;
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
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Enable Row-Level Security on all tables
alter table profiles enable row level security;
alter table posts enable row level security;
alter table drawings enable row level security;
alter table comments enable row level security;
alter table comment_votes enable row level security;
alter table reactions enable row level security;
alter table follows enable row level security;
alter table bookmarks enable row level security;
alter table tags enable row level security;
alter table post_tags enable row level security;
alter table notifications enable row level security;
alter table reports enable row level security;
alter table feature_flags enable row level security;

-- 1. Profiles Policies
create policy "Profiles viewable by everyone" on profiles for select using (true);
create policy "Users update own profile" on profiles for update using (auth.uid() = id);
create policy "Owners do all on profiles" on profiles for all using (public.get_my_role() = 'owner');

-- 2. Posts Policies
create policy "Select published posts" on posts for select using (
  (status = 'published' and visibility = 'public') or
  (status = 'published' and visibility = 'unlisted' and auth.uid() is not null) or
  (author_id = auth.uid()) or
  (public.get_my_role() = 'owner')
);
create policy "Insert posts for author or owner" on posts for insert with check (
  (author_id = auth.uid()) or (public.get_my_role() = 'owner')
);
create policy "Update posts for author or owner" on posts for update using (
  (author_id = auth.uid()) or (public.get_my_role() = 'owner')
);
create policy "Delete posts for author or owner" on posts for delete using (
  (author_id = auth.uid()) or (public.get_my_role() = 'owner')
);

-- 3. Drawings Policies
create policy "Select drawings for readable posts" on drawings for select using (
  exists(select 1 from posts where id = drawings.post_id)
);
create policy "Insert drawings for author or owner" on drawings for insert with check (
  (author_id = auth.uid()) or (public.get_my_role() = 'owner')
);
create policy "Update drawings for author or owner" on drawings for update using (
  (author_id = auth.uid()) or (public.get_my_role() = 'owner')
);
create policy "Delete drawings for author or owner" on drawings for delete using (
  (author_id = auth.uid()) or (public.get_my_role() = 'owner')
);

-- 4. Comments Policies
create policy "Select comments if post is readable" on comments for select using (
  exists(select 1 from posts where id = comments.post_id)
);
create policy "Insert comments for authenticated users" on comments for insert with check (
  auth.uid() is not null and author_id = auth.uid()
);
create policy "Update/delete own comments or as owner" on comments for all using (
  author_id = auth.uid() or public.get_my_role() = 'owner'
);

-- 5. Comment Votes Policies
create policy "Select comment votes" on comment_votes for select using (true);
create policy "Insert own comment votes" on comment_votes for insert with check (user_id = auth.uid());
create policy "Update/delete own comment votes" on comment_votes for all using (user_id = auth.uid());

-- 6. Reactions Policies
create policy "Select reactions" on reactions for select using (true);
create policy "All reactions for owners" on reactions for all using (user_id = auth.uid());

-- 7. Follows Policies
create policy "Select follows" on follows for select using (true);
create policy "All follows for followers" on follows for all using (follower_id = auth.uid());

-- 8. Bookmarks Policies
create policy "All bookmarks for own user" on bookmarks for all using (user_id = auth.uid());

-- 9. Tags & Post Tags Policies
create policy "Select tags" on tags for select using (true);
create policy "All tags for owners" on tags for all using (public.get_my_role() = 'owner');
create policy "Select post tags" on post_tags for select using (true);
create policy "All post tags for post author or owner" on post_tags for all using (
  public.get_my_role() = 'owner' or exists(select 1 from posts where id = post_id and author_id = auth.uid())
);

-- 10. Notifications Policies
create policy "Select own notifications" on notifications for select using (user_id = auth.uid());
create policy "Update own notifications" on notifications for update using (user_id = auth.uid());
create policy "Insert notifications for authenticated" on notifications for insert with check (auth.uid() is not null);

-- 11. Reports Policies
create policy "Insert reports for authenticated" on reports for insert with check (reporter_id = auth.uid());
create policy "All reports for reporter or owner" on reports for all using (reporter_id = auth.uid() or public.get_my_role() = 'owner');

-- 12. Feature Flags Policies
create policy "Select feature flags" on feature_flags for select using (true);
create policy "All feature flags for owner" on feature_flags for all using (public.get_my_role() = 'owner');

-- 13. Storage Setup and RLS Policies for Avatar Buckets
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Public Access to Avatars" on storage.objects for select using (bucket_id = 'avatars');
create policy "Upload own Avatar folder" on storage.objects for insert with check (
  bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
);
create policy "Update own Avatar folder" on storage.objects for update using (
  bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
);
create policy "Delete own Avatar folder" on storage.objects for delete using (
  bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
);
