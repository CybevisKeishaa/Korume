-- Private Storage bucket for shadowing/dictation voice recordings (CLAUDE.md §2:
-- recordings belong to the user, are not public, and must be encrypted at rest —
-- Supabase Storage encrypts objects at rest by default; `public=false` here is
-- the access-control half of that guarantee). NEVER a video bucket (§2.1) —
-- this bucket holds recordings/avatars/mining audio clips only.
--
-- Path convention (enforced by the RLS policies below): every object key MUST
-- be prefixed `{auth.uid()}/...`, e.g. `550e8400-.../shadowing/<session_id>.webm`.
-- backend-engineer: upload paths must start with the uploading user's id or the
-- INSERT policy will reject them.

insert into storage.buckets (id, name, public)
values ('recordings', 'recordings', false)
on conflict (id) do nothing;

-- storage.objects already has RLS enabled by Supabase; add owner-scoped policies
-- for this bucket only (other buckets, if any, are unaffected).
create policy recordings_select_own on storage.objects for select to authenticated
  using (bucket_id = 'recordings' and (storage.foldername(name))[1] = auth.uid()::text);

create policy recordings_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'recordings' and (storage.foldername(name))[1] = auth.uid()::text);

create policy recordings_update_own on storage.objects for update to authenticated
  using (bucket_id = 'recordings' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'recordings' and (storage.foldername(name))[1] = auth.uid()::text);

create policy recordings_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'recordings' and (storage.foldername(name))[1] = auth.uid()::text);
