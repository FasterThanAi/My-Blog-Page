-- Highlights: readers can save a selected excerpt from a post and share it
-- as a styled quote image (rendered on demand via /api/og/highlight).
create table highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) not null,
  post_id uuid references posts(id) on delete cascade not null,
  text text not null check (char_length(text) between 1 and 500),
  created_at timestamptz not null default now()
);

create index highlights_user_idx on highlights (user_id, created_at desc);
create index highlights_post_idx on highlights (post_id);

alter table highlights enable row level security;

create policy "Select highlights" on highlights for select using (true);
create policy "Insert own highlights" on highlights for insert with check (user_id = auth.uid());
create policy "Delete own highlights" on highlights for delete using (user_id = auth.uid());
