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

-- One home for "may this learner open this lesson's content" (port-dashboard spec §4 C4). The transcript policies,
-- the Dashboard Journey and the mission engine all call it. Invoker: under RLS it sees only the caller's own
-- subscription and library rows; the service-role mission engine passes the learner explicitly.
create function can_open_lesson(p_video_id uuid, p_user uuid) returns boolean
  language sql stable security invoker set search_path = public
as $$
  select exists (
    select 1 from videos v
    where v.id = p_video_id
      and (
        v.library_access = 'FREE'
        or (v.library_access = 'PLUS' and exists (
             select 1 from subscriptions s
             where s.user_id = p_user and s.plan <> 'free' and s.status = 'active'))
        or (v.library_access = 'PRIVATE' and exists (
             select 1 from user_lesson_library l where l.user_id = p_user and l.lesson_id = v.id))
        or v.added_by_user_id = p_user
      )
  );
$$;
revoke execute on function can_open_lesson(uuid, uuid) from public, anon;
grant execute on function can_open_lesson(uuid, uuid) to authenticated, service_role;

drop policy transcripts_read on transcripts;
create policy transcripts_read on transcripts for select to authenticated
  using (can_open_lesson(transcripts.video_id, auth.uid()));

drop policy transcript_lines_read on transcript_lines;
create policy transcript_lines_read on transcript_lines for select to authenticated
  using (exists (
    select 1 from transcripts t
    where t.id = transcript_lines.transcript_id
      and can_open_lesson(t.video_id, auth.uid())
  ));

drop policy videos_insert on videos;
create policy videos_insert on videos for insert to authenticated
  with check (added_by_user_id = auth.uid() and library_access = 'PRIVATE');
