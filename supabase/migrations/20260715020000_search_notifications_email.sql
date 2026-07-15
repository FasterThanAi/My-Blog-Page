-- 1. Alter profiles table to add email_notifications toggle
alter table profiles add column if not exists email_notifications boolean not null default true;

-- 2. Create email logs table to implement batch-guard rate limiting
create table if not exists email_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  event_type text not null,
  sent_at timestamptz not null default now()
);

-- Enable RLS on email logs
alter table email_logs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'email_logs' and policyname = 'All email logs for owners'
  ) then
    create policy "All email logs for owners" on email_logs for all using (public.get_my_role() = 'owner');
  end if;
end $$;

-- 3. Create helper function to retrieve user email from auth.users (security definer bypasses client-side restrictions)
create or replace function get_user_email(user_id uuid)
returns text security definer stable as $$
begin
  return (select email from auth.users where id = user_id);
end;
$$ language plpgsql;

-- 4. Create optimized text-search ranking function
create or replace function search_posts(search_query text)
returns table (
  id uuid,
  author_id uuid,
  title text,
  slug text,
  excerpt text,
  published_at timestamptz,
  author_username text,
  author_display_name text,
  author_avatar_url text,
  headline text,
  rank real
) security invoker as $$
begin
  return query
  select
    p.id,
    p.author_id,
    p.title,
    p.slug,
    p.excerpt,
    p.published_at,
    pr.username as author_username,
    pr.display_name as author_display_name,
    pr.avatar_url as author_avatar_url,
    ts_headline('english', coalesce(p.title, '') || ' ' || coalesce(p.excerpt, ''), websearch_to_tsquery('english', search_query), 'StartSel=<mark class="bg-accent/20 text-accent font-medium px-1 rounded">, StopSel=</mark>, MaxWords=35, MinWords=15, ShortWord=3') as headline,
    ts_rank(p.search_vector, websearch_to_tsquery('english', search_query)) as rank
  from posts p
  join profiles pr on p.author_id = pr.id
  where
    p.status = 'published'
    and p.visibility = 'public'
    and p.search_vector @@ websearch_to_tsquery('english', search_query)
  order by rank desc;
end;
$$ language plpgsql;

-- 5. Enable Realtime on notifications table
alter publication supabase_realtime add table notifications;
