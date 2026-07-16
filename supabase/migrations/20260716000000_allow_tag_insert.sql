-- Allow authenticated users to insert new tags
create policy "Insert tags for authenticated users" on tags for insert with check (
  auth.role() = 'authenticated'
);
