-- Recommendations network: authors can recommend other authors/blogs to
-- their own readers (Substack "Recommendations" equivalent). Shown on the
-- recommender's public profile.
create table author_recommendations (
  recommender_id uuid references profiles(id) not null,
  recommended_id uuid references profiles(id) not null,
  note text,
  created_at timestamptz not null default now(),
  primary key (recommender_id, recommended_id),
  check (recommender_id <> recommended_id)
);

create index author_recommendations_recommended_idx on author_recommendations (recommended_id);

alter table author_recommendations enable row level security;

create policy "Select author recommendations" on author_recommendations for select using (true);
create policy "All author recommendations for own user" on author_recommendations for all using (
  recommender_id = auth.uid() and not public.is_suspended()
);
