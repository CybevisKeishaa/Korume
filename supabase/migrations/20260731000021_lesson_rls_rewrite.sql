-- supabase/migrations/20260731000021_lesson_rls_rewrite.sql
-- Shadowing Hub Lesson Workspace spec §1.2 / §9 item 3. Replaces the
-- status='approved' predicate with the three-branch library_access check.
-- Drops the old policies first (Postgres has no `create or replace policy`).

drop policy videos_read on videos;
create policy videos_read on videos for select to authenticated using (
  library_access = 'FREE'
  or (library_access = 'PLUS' and exists (
       select 1 from subscriptions s
       where s.user_id = auth.uid() and s.plan <> 'free' and s.status = 'active'
     ))
  or (library_access = 'PRIVATE' and exists (
       select 1 from user_lesson_library l
       where l.user_id = auth.uid() and l.lesson_id = videos.id
     ))
  or added_by_user_id = auth.uid()
);

drop policy transcripts_read on transcripts;
create policy transcripts_read on transcripts for select to authenticated
  using (exists (
    select 1 from videos v
    where v.id = transcripts.video_id
      and (
        v.library_access = 'FREE'
        or (v.library_access = 'PLUS' and exists (
             select 1 from subscriptions s
             where s.user_id = auth.uid() and s.plan <> 'free' and s.status = 'active'
           ))
        or (v.library_access = 'PRIVATE' and exists (
             select 1 from user_lesson_library l
             where l.user_id = auth.uid() and l.lesson_id = v.id
           ))
        or v.added_by_user_id = auth.uid()
      )
  ));

drop policy transcript_lines_read on transcript_lines;
create policy transcript_lines_read on transcript_lines for select to authenticated
  using (exists (
    select 1 from transcripts t join videos v on v.id = t.video_id
    where t.id = transcript_lines.transcript_id
      and (
        v.library_access = 'FREE'
        or (v.library_access = 'PLUS' and exists (
             select 1 from subscriptions s
             where s.user_id = auth.uid() and s.plan <> 'free' and s.status = 'active'
           ))
        or (v.library_access = 'PRIVATE' and exists (
             select 1 from user_lesson_library l
             where l.user_id = auth.uid() and l.lesson_id = v.id
           ))
        or v.added_by_user_id = auth.uid()
      )
  ));

drop policy videos_insert on videos;
create policy videos_insert on videos for insert to authenticated
  with check (added_by_user_id = auth.uid() and library_access = 'PRIVATE');
