-- Storage RLS for ind-audio bucket (voice recordings attached to ind_items).
-- The bucket itself must be created in the Supabase Dashboard (Storage → New bucket)
-- or via CLI: supabase storage create ind-audio
-- Set public: false. Files are served via signed URL or public URL per policy below.

-- Authenticated users may upload files only into their own UID folder.
create policy "ind_audio_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'ind-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users may read their own files.
create policy "ind_audio_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'ind-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users may delete their own files.
create policy "ind_audio_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'ind-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
