# youtube-vi-captions + lesson-creation-rate-limit — run state (2026-10-20, CLOSED, both MERGED)

Both branches are MERGED to master and NOT pushed:
- `youtube-vi-captions` → master `55f069b5` (commits 461d79d9, a2ec5cb2, 4354b7e7, 3a462f32, 45bfae92)
- `lesson-creation-rate-limit` → master `5c076987` (commits 2156a5f8, 756d6a26)
Worktree `.worktrees/youtube-vi-captions` kept (now on branch `lesson-creation-rate-limit`).

## Why
The owner noticed imported (YouTube) lessons had no Vietnamese translation, while the system shows one.
Root cause: the pipeline fetched only the `ja` caption track and `lib/data/transcript-providers.ts` hard-coded
`textTranslation: null`. The `[ja-vi]` SRT used to seed Ep.729 is YouTube's own auto-translation (`&tlang=vi`),
and that is closed: YouTube answers HTTP 429 to every keyless client (ANDROID and WEB InnerTube), probed live.

## What shipped
1. **Creator Vietnamese track** (`lib/youtube/timedtext.ts`): a manual `vi`/`vi-*` track (never asr) is fetched
   after the ja body and aligned onto the ja lines. Best-effort on both paths: a vi failure never costs the lesson.
2. **One home for alignment**: `lib/transcript/align.ts` — `alignTranslations` (each cue joins the ja line it
   overlaps longest, strictly positive overlap) and `parseBilingualTranscript(raw, translationRaw, format)`.
3. **Admin import from subtitle files**: `/admin/videos` → "Nhập bài học từ file phụ đề" (link + ja SRT/VTT +
   optional vi + FREE/PLUS). `importVideoFromSrt` in `lib/data/admin-videos.ts`, route
   `app/api/admin/videos/import-srt`, form `components/admin/srt-import-form.tsx`. No caption request to YouTube
   (only oEmbed). New video: insert PRIVATE → transcript → set tier; deleted again if the transcript write fails.
   Existing video: 409 + confirm dialog (shows current tier) before replacing, because replacing deletes learner
   notes/marks on the old lines.
4. **One metadata bar**: `lessonMetadata` in `lib/youtube/oembed.ts`, used by the worker and the admin import
   (https thumbnail required for both).
5. **Seed script** `scripts/seed-real-lesson.ts` aligns by time, accepts `[vi]` or `[ja-vi]`; local db only.
   On Ep.729 it reproduces the old index pairing exactly (282/282).
6. **Rate-limit backoff**: `RateLimitedLessonCreationProviderError` (429, captcha, "not a bot", oEmbed 429) →
   the worker waits `RATE_LIMITED_RETRY_DELAY_MS` = half `STALE_QUEUED_JOB_SECONDS` (5 min). It MUST stay below
   the stale window: the learner's status read fails a due queued job whose `updated_at` is older than the window
   when no worker ran in it — on an idle queue, exactly when a requeued job falls due. So a job survives ~10 min
   of rate limiting (3 attempts), not hours. The progress view says the job will be retried on its own (no ETA,
   design §9), inside the live region.

## Evidence
Full vitest 6001/6001 at 756d6a26; tsc 0; verify:protocol valid. Mutation-checked every change (~25 mutations,
all red). Live through the real form against the local db (throwaway admin, video dQw4w9WgXcQ with Ep.729
files, then deleted): 282 lines / 282 translated / 282 furigana; re-import shows the confirm, keeps the tier;
keyboard focus stays on the submit button (measured in Chromium — the cause of the loss was `disabled={busy}`
on the focused button, not the form remount).
Reviews: code-reviewer per commit + a whole-branch review + a re-review of the fix commit; all findings fixed
or recorded below.

## Open
1. **Live probe of a real creator vi track never ran** — this machine's IP was 429-blocked for timedtext for 3.5h+
   (caused by my own `tlang` probes; recorded in docs/lessons.md L-042). Risk: a vi track baseUrl carrying
   `exp=xpe` would be skipped silently. Run `scripts/probe-youtube-captions.ts -- <id>` once on a video with a
   creator vi track; it prints "N with Vietnamese".
2. **AI ja→vi translation** for learner self-imports without a vi track — owner approved ("không nhiều"), not
   started. Add `lang="vi"` to the translation `<p>`s at the same time.
3. Surviving hours of rate limiting needs SQL: stale predicate measured from `available_at`, and a rate-limit
   attempt budget. Offered, not approved.
4. Owner calls: show vi translations to `en`-locale learners?; backfill vi for lessons imported earlier
   (re-import does nothing — finalize reuses the existing transcript).
5. Known minors left: writeVideoTranscript is delete/insert/insert, not one transaction (ponytail note names the
   RPC upgrade); an oEmbed 503 is still terminal `metadata_unavailable`.
6. Failed learner jobs `kIDaXEnkjmk`, `n3nmNZSfuoc` (temporary_failure) can be retried once YouTube unblocks.

## Local-only facts
- Admin login for the local db: `dev-admin@korume.test`; password in gitignored `.env.dev-admin.local`.
- The app never links a learner screen to admin: open `/vi/admin/videos` directly (or log in with
  `?redirectTo=%2Fvi%2Fadmin%2Fvideos`).
