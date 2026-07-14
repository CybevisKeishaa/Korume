# Product Readiness Audit (2026-07-14) — pre-Layer-8 gate

Full user-journey audit (static code map + live browser click-through on local stack, fresh
user `audit.user@example.com` + admin `admin@almostgone.vn`). Purpose: can a real learner use
the product today? **Answer: NO — 1 critical product gap + 2 critical env misconfigs.**

## Critical blockers (must fix before real users / Layer 8)
1. **User transcript ingestion UI does not exist** (product gap, frontend). Import works
   (oEmbed→pending video→shadowing page) but panel says "Transcript submission is coming
   soon." — dead end. `shadowing-view.tsx:24` comment: "later task adds ingestion UI"
   (deferred in L3, NEVER tracked in feature backlog = mandate violation). Backend is DONE:
   `POST /api/videos/[id]/transcript` (owner-only RLS, migration 9) verified live → 201,
   parse+sanitize+furigana all work. Only the UI half is missing. Admin CAN attach via
   /admin/videos dialog. Everything downstream (shadowing/dictation/mining/pitch/summary/
   difficulty/recommendations) works once transcript exists — verified end-to-end.
2. **AZURE_SPEECH_KEY in .env.local is INVALID** — Azure token endpoint returns 401
   (key looks like a GUID = probably resource ID copied instead of Key1/Key2). Kills JLPT
   listening (TTS 502, "Couldn't play the audio"), pronunciation scoring, voice mode, pitch
   reference. **Supersedes the "Azure configured, speech live" claim in project_status /
   layer-4 memories — it was never verified end-to-end.**
3. **ANTHROPIC_API_KEY absent from .env.local** (memory claim "set" is stale). All Claude
   features degrade cleanly ("isn't set up yet for this deployment" / "Conversation is not
   configured") but are unusable.

Also: ADMIN_EMAILS was empty until this audit; user set `admin@almostgone.vn` (local). Without
it on a fresh deploy there is NO path to any admin → no transcript/approval at all.

## Verified working end-to-end (live)
- Register (auto-signin) → dashboard; login/logout; middleware guards.
- Video import (idempotent, oEmbed, pending status, redirects to shadowing).
- Full pipeline once transcript+approval exist: transcript API → furigana per line →
  shadowing player (IFrame sync, line select seeks, A–B loop, speed, adaptive-furigana
  3-state, translation toggle, Record button appears on line select) → tap-to-mine
  (kanji-candidate popover, card created) → /mining deck + SM-2 review → dictation
  (line nav, submit → Accuracy %) → admin approve → i+1 recommendation rail shows video
  with difficulty label ("Challenge · 0% words you know").
- SRS: vocab/kanji review queues, space/1-4 keys, XP+notification badge fired (bell=1).
- Kanji list/detail (stroke render, VN gloss), grammar library, JLPT hub + timed runner
  (timer, navigator, answer select), reading passage (furigana, word-level lookup buttons,
  translation disclosure, quiz submit → correct-answer reveal + VN explanations).
- Community: forum post create (verified in DB), leaderboard (own-week-first + opt-in),
  playlists page, peer-review page (empty queue).
- Admin: bootstrap promotion on first /admin visit ✅, stats dashboard, video queue
  (approve ✅, attach-transcript dialog ✅, reject untested=hard delete), content CRUD
  tables + CSV import button.

## Not testable via automation (needs manual pass)
Mic flows: shadowing recording→pitch overlay→session save; voice mode; peer-review share.
Audio playback quality (mining clip, TTS once Azure fixed). Google OAuth (no local creds).

## Other findings (non-blocking, severity Medium/Low)
- Register page headline still "Start your 7-day trial" — contradicts business-model
  (no-trial/Contextual Discovery). Fix copy in L8.
- New user sees "105 cards due for review" on day one (entire seed catalog due) — overwhelm;
  consider staged introduction of new items.
- Dictionary lookup shows NO MEANINGS anywhere: reading popover = word+reading only,
  video mine popover = add-to-deck only. No dictionary data source (JMdict etc.) or lookup
  into own vocab table. Users can't learn what a tapped word means.
- No sentence-level grammar analysis / particle highlighting anywhere (spec motion-engineer
  differentiator; static /grammar library only). Untracked in backlog.
- Shadowing page <title> is generic site title (missing per-page metadata).
- TTS route maps invalid-key upstream failure to 502 (503 reserved for not-configured);
  fine, but server logs show no error detail for 5xx — hard to diagnose in prod.
- `firebase-messaging-sw.js` 404s in dev log = browser extension noise, NOT our code.

## Test data created locally (cleanup = `npx supabase db reset`)
Users audit.user@example.com / admin@almostgone.vn (is_admin=true); video dQw4w9WgXcQ
(approved, 5-line SRT transcript); 1 mining card; 1 forum post "Audit test post"; XP events.

## Trạng thái phiên (resume point cho session sau)
- Audit HOÀN TẤT. Chưa fix gì — mới chỉ chẩn đoán + ghi memory + thêm backlog (item 14/15/16).
- Local stack đang chạy phiên này (Docker Supabase + `npm run dev` :3000); session sau phải
  tự khởi động lại (`npx supabase start`, `npm run dev`) — trạng thái process không giữ.
- `.env.local` đã thêm `ADMIN_EMAILS="admin@almostgone.vn"` (giữ lại). AZURE key vẫn SAI,
  ANTHROPIC key vẫn THIẾU — user cần cấp key thật trước khi verify lại nhóm speech/AI.
- Test data còn trong DB (xem mục dưới) — `npx supabase db reset` để dọn.
- CHƯA chạy: `npx tsc --noEmit` / `npm test` / `npm run build` trong phiên này (audit thuần
  browser). Chạy verify commands trước khi bắt đầu sửa để có baseline.

## Agreed next steps (user-stated plan)
Prioritize blockers → fix → re-verify whole pipeline → then Layer 8.
Obvious fix list: (a) build user transcript-submit UI on shadowing page (backend ready),
(b) replace Azure key with real Key1 + verify token endpoint, (c) add ANTHROPIC_API_KEY,
(d) keep ADMIN_EMAILS set for deploy, (e) register-page copy, (f) plan dictionary-meaning
source (fits F-010/adaptive furigana data).
