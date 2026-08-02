-- Post Versions: snapshots of a post's title/content over time, powering
-- revision history + rollback in the editor. Snapshots are taken
-- automatically (throttled) during autosave, and always before a restore.
create table post_versions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade not null,
  author_id uuid references profiles(id) not null,
  title text not null default '',
  content jsonb not null default '{}',
  label text not null default 'Autosave',
  created_at timestamptz not null default now()
);

create index post_versions_post_idx on post_versions (post_id, created_at desc);

alter table post_versions enable row level security;

create policy "Select post versions for post author or owner" on post_versions for select using (
  public.get_my_role() = 'owner' or exists(select 1 from posts where id = post_versions.post_id and author_id = auth.uid())
);
create policy "Insert post versions for post author or owner" on post_versions for insert with check (
  public.get_my_role() = 'owner' or exists(select 1 from posts where id = post_versions.post_id and author_id = auth.uid())
);
create policy "Delete post versions for post author or owner" on post_versions for delete using (
  public.get_my_role() = 'owner' or exists(select 1 from posts where id = post_versions.post_id and author_id = auth.uid())
);
