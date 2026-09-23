/**
 * Every table a reader owns, for `GET /api/user/export` (settings spec §4.6).
 *
 * Account deletion relies on the `users` cascade and keeps no table list, so
 * this is the only enumeration of personal data in the codebase. It is
 * guarded: `tables.test.ts` reads the migrations and fails when a table with a
 * user-referencing foreign key is neither listed here nor excluded with a
 * reason.
 *
 * `account_deletion_tombstones` is deliberately absent rather than excluded:
 * it carries no `users` foreign key by design — it has to outlive the cascade
 * — so the scan never collects it, and listing it would fail the guard's
 * "lists nothing the schema does not have" check.
 */
export interface UserExportTable {
  table: string;
  /** The column holding the owner's id. */
  userColumn?: string;
  /** For a table with no owner column: the exported parent that scopes it. */
  via?: { parent: string; column: string; parentKey: string };
}

export const USER_EXPORT_TABLES: readonly UserExportTable[] = [
  { table: "users", userColumn: "id" },
  { table: "user_preferences", userColumn: "user_id" },
  { table: "user_stats", userColumn: "user_id" },
  { table: "user_badges", userColumn: "user_id" },
  { table: "xp_events", userColumn: "user_id" },
  { table: "user_kanji_progress", userColumn: "user_id" },
  { table: "user_vocab_progress", userColumn: "user_id" },
  { table: "user_grammar_progress", userColumn: "user_id" },
  { table: "user_reading_attempts", userColumn: "user_id" },
  { table: "user_test_attempts", userColumn: "user_id" },
  { table: "user_video_progress", userColumn: "user_id" },
  { table: "user_lesson_library", userColumn: "user_id" },
  { table: "user_playlists", userColumn: "user_id" },
  {
    table: "user_playlist_items",
    via: { parent: "user_playlists", column: "playlist_id", parentKey: "id" },
  },
  { table: "sentence_mining_cards", userColumn: "user_id" },
  { table: "shadowing_sessions", userColumn: "user_id" },
  { table: "dictation_attempts", userColumn: "user_id" },
  { table: "companion_memories", userColumn: "user_id" },
  { table: "conversation_sessions", userColumn: "user_id" },
  {
    table: "conversation_messages",
    via: { parent: "conversation_sessions", column: "session_id", parentKey: "id" },
  },
  { table: "notifications", userColumn: "user_id" },
  { table: "forum_posts", userColumn: "user_id" },
  { table: "forum_comments", userColumn: "user_id" },
  { table: "peer_reviews", userColumn: "reviewer_id" },
  { table: "peer_review_shares", userColumn: "user_id" },
  { table: "subscriptions", userColumn: "user_id" },
  { table: "account_deletion_requests", userColumn: "user_id" },
  { table: "lesson_creation_jobs", userColumn: "requester_user_id" },
  {
    table: "lesson_creation_job_events",
    via: { parent: "lesson_creation_jobs", column: "job_id", parentKey: "id" },
  },
];

export const USER_EXPORT_EXCLUSIONS: Record<string, string> = {
  videos:
    "Shared catalogue content, not personal data: `added_by_user_id` records who imported a lesson everyone can watch, and exporting the row would hand one reader the catalogue. Excluding it also keeps its children — transcripts, video_summaries, lesson_collections — out, since they describe the lesson rather than the reader.",
};
