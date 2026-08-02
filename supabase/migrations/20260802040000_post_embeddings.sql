-- Enables semantic search over posts: pgvector + a post_embeddings table
-- (one 768-dim embedding per post, from Gemini's text-embedding-004),
-- plus an RPC for cosine-similarity search used by the "ask the archive"
-- RAG chatbot and the personalized "For You" feed.
create extension if not exists vector;

create table post_embeddings (
  post_id uuid primary key references posts(id) on delete cascade,
  embedding vector(768) not null,
  content_hash text not null,
  updated_at timestamptz not null default now()
);

-- IVFFlat index for approximate nearest-neighbor cosine search. Fine for
-- a blog-scale corpus; lists=100 is a reasonable default that can be
-- tuned later as the number of posts grows.
create index post_embeddings_ivfflat_idx on post_embeddings
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);

alter table post_embeddings enable row level security;

-- Embeddings mirror already-public post content; readable by anyone,
-- written only through the security-definer RPC / server routes.
create policy "Select post embeddings" on post_embeddings for select using (true);
create policy "Insert post embeddings for post author or owner" on post_embeddings for insert with check (
  public.get_my_role() = 'owner' or exists(select 1 from posts where id = post_embeddings.post_id and author_id = auth.uid())
);
create policy "Update post embeddings for post author or owner" on post_embeddings for update using (
  public.get_my_role() = 'owner' or exists(select 1 from posts where id = post_embeddings.post_id and author_id = auth.uid())
);

-- Cosine-similarity search over published, public posts only.
create or replace function match_posts(query_embedding vector(768), match_count int default 5)
returns table (post_id uuid, similarity float)
language sql stable
as $$
  select pe.post_id, 1 - (pe.embedding <=> query_embedding) as similarity
  from post_embeddings pe
  join posts p on p.id = pe.post_id
  where p.status = 'published' and p.visibility = 'public' and p.is_hidden = false
  order by pe.embedding <=> query_embedding
  limit match_count;
$$;
