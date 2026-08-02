-- Reading History: tracks per-user scroll progress on posts, powers
-- "continue where you left off" and reading streak stats.
create table reading_history (
  user_id uuid references profiles(id) not null,
  post_id uuid references posts(id) on delete cascade not null,
  scroll_percent smallint not null default 0 check (scroll_percent between 0 and 100),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create index reading_history_user_updated_idx on reading_history (user_id, updated_at desc);
create index reading_history_streak_idx on reading_history (user_id, completed_at);

alter table reading_history enable row level security;

create policy "All reading history for own user" on reading_history for all using (user_id = auth.uid());
