-- 1. Add columns for suspension and hidden moderation flags
alter table public.profiles add column if not exists suspended_at timestamptz;
alter table public.posts add column if not exists is_hidden boolean not null default false;
alter table public.comments add column if not exists is_hidden boolean not null default false;
alter table public.reactions add column if not exists created_at timestamptz default now();

-- 2. Create moderation log table
create table if not exists public.moderation_log (
  id uuid primary key default gen_random_uuid(),
  moderator_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_id text not null,
  target_type text not null,
  reason text,
  created_at timestamptz default now()
);

-- 3. Enable RLS on moderation_log
alter table public.moderation_log enable row level security;

-- 4. RLS policies for moderation_log
create policy "Owners do all on moderation_log" on public.moderation_log
  for all using (public.get_my_role() = 'owner');

-- 5. Helper function to check if the current user is suspended
create or replace function public.is_suspended()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and suspended_at is not null
  );
$$ language sql security definer stable;

-- 6. Drop existing write RLS policies and recreate them with is_suspended checks

-- Posts insert/update/delete
drop policy if exists "Insert posts for author or owner" on public.posts;
drop policy if exists "Update posts for author or owner" on public.posts;
drop policy if exists "Delete posts for author or owner" on public.posts;

create policy "Insert posts for author or owner" on public.posts
  for insert with check (((author_id = auth.uid()) or (public.get_my_role() = 'owner')) and not public.is_suspended());

create policy "Update posts for author or owner" on public.posts
  for update using (((author_id = auth.uid()) or (public.get_my_role() = 'owner')) and not public.is_suspended());

create policy "Delete posts for author or owner" on public.posts
  for delete using (((author_id = auth.uid()) or (public.get_my_role() = 'owner')) and not public.is_suspended());

-- Comments insert/update/delete
drop policy if exists "Insert comments for authenticated users" on public.comments;
drop policy if exists "Update/delete own comments or as owner" on public.comments;

create policy "Insert comments for authenticated users" on public.comments
  for insert with check ((auth.uid() is not null and author_id = auth.uid()) and not public.is_suspended());

create policy "Update/delete own comments or as owner" on public.comments
  for all using ((author_id = auth.uid() or public.get_my_role() = 'owner') and not public.is_suspended());

-- Comment Votes insert/update/delete
drop policy if exists "Insert own comment votes" on public.comment_votes;
drop policy if exists "Update/delete own comment votes" on public.comment_votes;

create policy "Insert own comment votes" on public.comment_votes
  for insert with check ((user_id = auth.uid()) and not public.is_suspended());

create policy "Update/delete own comment votes" on public.comment_votes
  for all using ((user_id = auth.uid()) and not public.is_suspended());

-- Reactions insert/update/delete
drop policy if exists "All reactions for owners" on public.reactions;

create policy "All reactions for owners" on public.reactions
  for all using ((user_id = auth.uid()) and not public.is_suspended());

-- Follows insert/update/delete
drop policy if exists "All follows for followers" on public.follows;

create policy "All follows for followers" on public.follows
  for all using ((follower_id = auth.uid()) and not public.is_suspended());

-- Bookmarks insert/update/delete
drop policy if exists "All bookmarks for own user" on public.bookmarks;

create policy "All bookmarks for own user" on public.bookmarks
  for all using ((user_id = auth.uid()) and not public.is_suspended());

-- Reports insert/update/delete
drop policy if exists "Insert reports for authenticated" on public.reports;

create policy "Insert reports for authenticated" on public.reports
  for insert with check ((reporter_id = auth.uid()) and not public.is_suspended());
