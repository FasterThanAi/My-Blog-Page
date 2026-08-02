-- Post Translations: on-demand Gemini translations of published posts,
-- cached per (post, locale) so repeat requests are free. Content is stored
-- as plain paragraphs (formatting is not preserved) — a lightweight
-- reading-mode translation rather than a full localized rich-text post.
create table post_translations (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade not null,
  locale text not null,
  title text not null default '',
  paragraphs jsonb not null default '[]',
  created_at timestamptz not null default now(),
  unique (post_id, locale)
);

create index post_translations_post_idx on post_translations (post_id);

alter table post_translations enable row level security;

-- Translations mirror already-public post content; caching is safe to
-- read/write for anyone (including anonymous readers who trigger a
-- translation), the API route is what's rate-limited.
create policy "Select post translations" on post_translations for select using (true);
create policy "Insert post translations" on post_translations for insert with check (true);
