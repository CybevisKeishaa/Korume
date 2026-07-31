-- supabase/migrations/20260731000022_drop_video_status.sql
-- Shadowing Hub Lesson Workspace spec §1.2 / §9 item 1 (part 2 of 2). Safe
-- now: Task 5 already rewrote every policy that referenced `status`.

alter table videos drop column status;
drop type video_status;
