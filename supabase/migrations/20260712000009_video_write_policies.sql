-- Video import + transcript ingestion (Layer 3) needs write policies that
-- 20260712000002_rls.sql never added: `videos`, `transcripts`, and
-- `transcript_lines` only got SELECT policies there. RLS defaults to deny
-- with no matching policy, so every authenticated INSERT/UPDATE against
-- these three tables was rejected even though the table-level GRANTs from
-- 20260712000006_grants.sql allow it. This is additive only — no existing
-- policy is touched.
--
-- REVISED IN PLACE (code review, two auth defects fixed before this ever
-- merged — this file was never applied to production, so it is edited
-- directly rather than patched with a follow-up migration):
--
-- Defect #1 (blocker): the original videos_update policy used
-- `status = 'approved' or added_by_user_id = auth.uid()` for BOTH `using`
-- and `with check`. That let (a) an owner flip their OWN pending video
-- straight to 'approved' (self-approval — a full moderation bypass, since
-- listVideos() then shows it to everyone), and (b) — because RLS filters
-- rows, not columns — ANY authenticated user rewrite title /
-- youtube_video_id / thumbnail_url / added_by_user_id on ANY approved video,
-- since the `status = 'approved'` half of the OR matched every approved row
-- regardless of who added it. The only legitimate authenticated write today
-- is a video's OWNER setting `duration_seconds` once (see
-- lib/data/videos.ts `setVideoDuration`, which updates only that column).
-- Approval is a service-role/admin-only flow (Layer 7); service_role
-- bypasses RLS entirely, so it needs no policy here.
--
-- Defect #2 (major): transcripts_insert / transcript_lines_insert allowed
-- any user who could SEE a video (i.e. any approved video) to insert a
-- transcript onto it, and getTranscript() returns the newest transcript —
-- so any signed-in user could silently overwrite the transcript everyone
-- else studies from (vandalism). Fixed by restricting transcript writes to
-- the video's OWNER, joined the same way transcripts_read already does.

-- Videos: a user may import (insert) a video, attributed to themselves and
-- always starting `pending` — self-approval at insert time is blocked too.
create policy videos_insert on videos for insert to authenticated
  with check (added_by_user_id = auth.uid() and status = 'pending');

-- Column-scoped grant: RLS gates the ROW, this grant gates the COLUMN. RLS
-- alone cannot stop an owner from writing title/status/etc. on their own
-- row, so the table-wide UPDATE grant from 20260712000006_grants.sql is
-- narrowed to the one column the app is ever allowed to touch directly.
revoke update on videos from authenticated;
grant update (duration_seconds) on videos to authenticated;

-- Update: owner-only, full stop. (Approval is service-role only, handled
-- outside RLS entirely — see note above.)
create policy videos_update on videos for update to authenticated
  using (added_by_user_id = auth.uid())
  with check (added_by_user_id = auth.uid());

-- Transcripts: only the video's OWNER may attach a transcript. Visibility
-- (transcripts_read) is intentionally broader than write eligibility.
create policy transcripts_insert on transcripts for insert to authenticated
  with check (exists (
    select 1 from videos v
    where v.id = transcripts.video_id
      and v.added_by_user_id = auth.uid()
  ));

-- Transcript lines: same owner-only restriction, derived via the parent
-- transcript -> video (mirrors transcript_lines_read's join shape).
create policy transcript_lines_insert on transcript_lines for insert to authenticated
  with check (exists (
    select 1 from transcripts t join videos v on v.id = t.video_id
    where t.id = transcript_lines.transcript_id
      and v.added_by_user_id = auth.uid()
  ));
