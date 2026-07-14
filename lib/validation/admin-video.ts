import { z } from "zod";

/** GET /api/admin/videos/pending?cursor=... — cursor is the `created_at` of
 * the last item on the previous page (opaque to the client). Loosely
 * validated (not `.datetime()`) because a malformed cursor should fail the
 * DB query (caught generically, 500) rather than be rejected here with a
 * misleadingly specific 400 — it's an opaque pagination token, not user input
 * with a meaningful "invalid" state to report back. */
export const pendingVideosQuerySchema = z.object({
  cursor: z.string().min(1).max(100).optional(),
});
export type PendingVideosQuery = z.infer<typeof pendingVideosQuerySchema>;

/** POST /api/admin/videos/[id]/reject body. `reason` is optional moderator
 * note, logged server-side only — see `lib/data/admin-videos.ts::rejectVideo`
 * doc comment for why it isn't persisted anywhere. */
export const rejectVideoSchema = z.object({
  reason: z.string().max(1000).optional(),
});
export type RejectVideoInput = z.infer<typeof rejectVideoSchema>;

/** PUT /api/admin/videos/[id]/transcript body. Unlike the owner-submitted
 * ingest endpoint (`transcriptIngestSchema` in `lib/validation/video.ts`,
 * which defaults `format` to `"auto"`), the admin attach flow requires the
 * moderator to state the format explicitly. */
export const adminTranscriptSchema = z.object({
  format: z.enum(["srt", "vtt", "plain"]),
  content: z
    .string()
    .min(1, "Transcript content is required.")
    .max(200_000, "Transcript is too long (max 200,000 characters)."),
});
export type AdminTranscriptInput = z.infer<typeof adminTranscriptSchema>;
