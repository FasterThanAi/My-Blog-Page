-- Notes: short-form updates (Substack "Notes" style) that surface in a
-- single cross-author discovery feed, separate from long-form posts.
create table notes (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references profiles(id) not null,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create index notes_created_idx on notes (created_at desc);
create index notes_author_idx on notes (author_id, created_at desc);

alter table notes enable row level security;

create policy "Select notes" on notes for select using (true);
create policy "Insert own notes" on notes for insert with check (author_id = auth.uid() and not public.is_suspended());
create policy "Delete own notes" on notes for delete using (author_id = auth.uid() or public.get_my_role() = 'owner');

-- Lightweight likes on notes (separate from the post `reactions` table)
create table note_likes (
  note_id uuid references notes(id) on delete cascade,
  user_id uuid references profiles(id),
  created_at timestamptz default now(),
  primary key (note_id, user_id)
);

alter table note_likes enable row level security;

create policy "Select note likes" on note_likes for select using (true);
create policy "All note likes for own user" on note_likes for all using (user_id = auth.uid() and not public.is_suspended());
