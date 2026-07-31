-- supabase/migrations/20260731000020_videos_promotion_starred.sql
-- Shadowing Hub Lesson Workspace spec §9 item 3.
-- Adds the `promotion_starred` column to support the admin "Ready to Promote" shortlist feature.
-- Purely additive — does not touch `status`, `library_access`, or any policy.

alter table videos add column promotion_starred boolean not null default false;
