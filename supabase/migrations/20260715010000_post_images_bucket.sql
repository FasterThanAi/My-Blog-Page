-- Create the post-images bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict (id) do nothing;

-- RLS policies for post-images storage bucket
create policy "Public Access to Post Images" on storage.objects for select using (bucket_id = 'post-images');

create policy "Upload post images in own folder" on storage.objects for insert with check (
  bucket_id = 'post-images' and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Update post images in own folder" on storage.objects for update using (
  bucket_id = 'post-images' and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Delete post images in own folder" on storage.objects for delete using (
  bucket_id = 'post-images' and auth.uid()::text = (storage.foldername(name))[1]
);
