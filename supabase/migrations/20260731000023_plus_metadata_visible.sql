-- Final whole-branch review (2026-08-01) found a self-contradiction in the
-- source spec: §1.2 says PLUS lessons must be "visible to everyone (card +
-- metadata)" for upsell ("show don't tell"), but the SQL §1.2 itself
-- prescribes (copied verbatim into 20260731000021) hides PLUS rows from
-- videos_read entirely unless the viewer has an active subscription. The
-- user resolved this in favor of the prose: widen videos_read so any
-- authenticated user can see a PLUS lesson's own row (metadata: title,
-- thumbnail, etc.) — transcripts_read/transcript_lines_read keep their
-- existing subscription-gated PLUS branch UNCHANGED, so the actual content
-- stays behind the paywall; only the "this exists, upgrade to open it" card
-- data is now visible.

drop policy videos_read on videos;
create policy videos_read on videos for select to authenticated using (
  library_access = 'FREE'
  or library_access = 'PLUS'
  or (library_access = 'PRIVATE' and exists (
       select 1 from user_lesson_library l
       where l.user_id = auth.uid() and l.lesson_id = videos.id
     ))
  or added_by_user_id = auth.uid()
);
