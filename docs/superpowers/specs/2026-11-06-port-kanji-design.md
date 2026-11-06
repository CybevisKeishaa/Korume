# Port Kanji — inspect (modal + page) and kanji review — design

Date: 2026-11-06 · Branch `port-kanji` (worktree `.worktrees/port-kanji`, from master `7e6d7825`)
Figma file `IwFHZDZdHW7qsSFiNbWrkd`: **Kanji inspect `28:2041`**, **Kanji lesson practice (flashcard) `280:1314`**.
Prior analysis: `docs/product/screen-inventory.md` §6 (2026-08-12; some data facts there are now stale — this spec wins).

## 1. Intent

The owner asked which port comes next and chose Kanji over Certification because Kanji has real content
(the dictionary import: 13,108 KANJIDIC2 kanji, 6,703 KanjiVG stroke sets with components, 87,625 ranked JMdict
words) while Certification has two 34-question mini tests. The point is a kanji screen a **Vietnamese** learner finds
complete: Hán Việt reading first, the Japanese meaning, the classical Hán meaning, stroke order, composition, the
words and the sentences from the learner's own lessons — and one-click actions to save it or put it into review.

Owner rulings in the conversation (2026-11-06):
- R1 Scope: Kanji **inspect** + Kanji **review**. Explorer (`29:2890`) and Library (`280:3`) are out — they need
  product decisions (collections, courses) and content that does not exist.
- R2 Vietnamese meaning comes from public sources, **never AI translation** ("tự dịch có khi không chuẩn"). Accepted:
  Hán Việt reading from KANJIDIC2, Japanese-sense meaning = KANJIDIC2 English, classical meaning = Thiều Chửu.
- R3 Inspect is a **modal with its own URL**: clicking a kanji opens it over the current page, Back closes it, the
  link can be shared; `/kanji/[literal]` stays a full page. Inside a lesson the existing small drawer inspect stays,
  and its existing "view full details" link opens the modal over the lesson. (Mechanism revised after the builder
  check — §5.1; the owner's agreed behaviour holds, except that a refresh keeps the modal over the page it was
  opened on instead of switching to the full page.)
- R4 Two separate collections: **♡ Favorite** = a saved list to look at again, no scheduling; **+ Add to Review** =
  schedules the kanji in SRS now.

## 2. Goals / non-goals / anti-goals

Goals
- G1 Hán Việt reading for every kanji KANJIDIC2 has one for (11,068 of 13,108; all 2,230 old-JLPT kanji).
- G2 Thiều Chửu meaning for ≥ 95 % of the 2,230 old-JLPT kanji (92 % match directly today; the rest via a
  shinjitai → kyūjitai mapping, §4.2).
- G3 Inspect modal + page matching `28:2041`'s composition, on the repo's tokens (L-051/L-052: frame at its own
  scale, type on `--text-*` tokens, keep the frame's icons and CTAs).
- G4 Kanji review in the `(focus)` chrome matching `280:1314`, including a designed post-reveal state.
- G5 Any dictionary kanji (not only the 46 curated rows) can be favorited and added to review.

Non-goals
- Explorer, Library, collections, courses, radicals browse, writing practice, "find similar kanji" logic.
- The persistent mini video player drawn across `28:2041` (an app-level concern; separate ruling).
- Mnemonic content (only 45 curated rows have text, none has an image) — shown when present, never generated.
- Mobile layouts (web is desktop-only).

Anti-goals (a failure even if it works)
- Any Vietnamese meaning text produced by a model. Any placeholder **content** (data) presented as real (the
  frame's `78%`, `Totoro 23 times`, sample sentences are placeholders). This does not cover CTAs: a frame CTA with
  no destination yet stays a link to `/` (owner ruling 2026-10-13, restated 2026-11-06; §5.2).
- Taking CVDICT/`e` entries, hvdic.thivien.net data, or KanjiDictVN data (§4.2 provenance).
- The modal breaking Back, deep links, or focus (Esc, focus trap, focus return).

## 3. Constraints

- Repo rules: AGENTS.md, `docs/lessons.md` (notably L-051, L-052, L-015), never build or serve in the main checkout.
- Licenses: KANJIDIC2/JMdict are EDRDG CC BY-SA 4.0, KanjiVG CC BY-SA 3.0 — already credited through
  `DictionaryAttribution`; the Thiều Chửu line is added to that credit (§4.2).
- GDPR erase: every new user-owned table cascades on `users` delete and is covered by the erase gate
  (`verify-db-erasure` pattern, [[supabase-anon-execute-default]]: revoke `from public, anon` on any new function).
- RSC → client props: strings/plain data only.

## 4. Data

### 4.1 Hán Việt reading (KANJIDIC2)
`lib/dictionary/import/kanjidic.ts` drops `<reading r_type="vietnam">`. Add `vi: string[]` to `KanjidicRow`,
a `vi_readings text[] not null default '{}'` column on `dict_kanji`, stage it in `stage.ts`, and re-run
`npm run dict:import` against `C:\Users\tplon\Desktop\Japan\Korume\DataKanji\` (the same files the current snapshot
came from). The importer returns `no-change` when the three source hashes match (`stage.ts:103-104`), so add a
`--force` flag that builds a new snapshot anyway (my call — smallest change). Values are as in the source
(`Học`, `Nhật`, `Lục`); display as given.

### 4.2 Thiều Chửu meaning
Source: Thiều Chửu, *Hán Việt tự điển* (1942; author died 1954 — public domain in Vietnam, as vi.wikisource marks it).
Machine-readable copy: `github.com/anhthommo/thonutiengtrung` `public/dict/00.json…3f.json` (64 shards, key = code
point hex, `hv` = reading, `tc` = Thiều Chửu sense lines). We take **only `tc`** (the public-domain text) and
**never `e`** (CVDICT-style AI-translated word glosses).
- **License status: UNVERIFIED — production release blocked (owner ruling 2026-11-06).** The repo states no license,
  and the work being public domain does not by itself settle the right to redistribute this digitization. Design,
  importer and UI proceed; the owner asks the repo author for a license / permission to use. Until there is a clear
  basis, `tc_lines` must not ship in a production release; if none comes, find an alternative source with a clear
  license (the importer stays the same, only the input changes). The section hides when `tc_lines` is empty, so a
  release without the data needs no code change.
- Pin the source: download at a fixed commit SHA into `DataKanji/thieu-chuu/` (outside the repo; the importer takes
  the path). The SHA and the credit line ("Thiều Chửu, Hán Việt tự điển (1942), public domain") are constants next to
  the importer; Thiều Chửu is **not** a fourth `dict_imports` source (that touches six places — my call, builder check Q3).
- Everything below is resolved **once, at import time**, into a `tc_lines text[] not null default '{}'` column on
  `dict_kanji`, keyed by the Japanese literal. Reading it is part of the existing one-row `dict_kanji` read.
- Resolution order for a Japanese literal: the literal itself → its kyūjitai form via a mapping table → none.
  The mapping is the 常用漢字表 old-form list (public government document, ~364 pairs: 気→氣, 駅→驛, 円→圓, 関→關 …),
  checked in as a small TS/JSON constant with its source cited. A `tc` whose first line is only a redirect
  ("Giản thể của chữ 學.", "Dị dạng của chữ [绿].") follows the redirect once to the target's lines, keeping any
  remaining lines of the original. One hop only, so loops cannot occur. When the target has no entry, or the
  target's own first line is again a redirect, the original lines are kept unchanged and the literal is listed as
  `redirect-unresolved` (missing target / chained redirect) in the coverage report — never silently dropped.
- Measured on 2026-11-06: 2,052 / 2,230 old-JLPT kanji match directly; the kyūjitai probes 氣 驛 圓 關 覺 樂 歡 觀 綠
  all resolve. Japanese-made kanji (畑, 込) have no entry — the section is hidden for them.
- Proof: the importer reports coverage over the old-JLPT set and fails the import below 95 %.

### 4.3 Review keyed by literal (my call — technical, invisible to the owner)
`user_kanji_progress` is keyed `(user_id, kanji_id → kanji.id)`, i.e. only the 46 curated rows can ever be reviewed,
so "Add to Review" on a dictionary kanji is impossible today. Change the key to the literal:
- Migration: add `literal text`, backfill from `kanji.character`, set `not null`, new PK `(user_id, literal)`, drop
  `kanji_id` (and its FK). Add `reviews int not null default 0` and `lapses int not null default 0`, maintained by
  `submitReview` (lapse = quality "Again").
  - No collision is possible: `kanji.character` is `text not null unique` (`20260712000001_schema.sql:97`), so
    `kanji_id → literal` is one-to-one and each existing `(user_id, kanji_id)` row maps to exactly one new key.
  - Every existing column is kept with its values: `srs_stage`, `next_review_at`, `ease_factor`, `last_reviewed_at`,
    `interval_days` (`20260712000004_srs_interval.sql`). Only `kanji_id` is dropped. The existing index on
    `(user_id, next_review_at)` (`20260712000003_indexes.sql:5`) and RLS policy `kanji_progress_own`
    (`20260712000002_rls.sql:82`, keyed on `user_id`) are unaffected. A DB test asserts row count and every column
    value are identical before/after on seeded rows.
- `srsReviewSchema.itemId` is `z.string().uuid()` (`lib/validation/content.ts:17`): the schema validates `itemId`
  **by `itemType` before any query** — vocab keeps the uuid, kanji must pass `parseKanjiLiteral`; any other string is
  a 400 and never reaches the kanji branch. `submitReview` (`srs.ts:39-44`) then validates a kanji literal against
  the active snapshot's `dict_kanji`, not the `kanji` table.
- Queue (my call, builder check Q1): **no `?level=`** ("Ôn tập hôm nay", the default deck) = every due row of the
  user, any literal, then fresh curated kanji; **with `?level=`** = today's behaviour (the level's curated list,
  due first, then fresh), keyed by literal. A dictionary kanji added through "Add to Review" therefore shows in the
  default deck, which is where `Review Now` and `Add to Review` send the learner. `?level=` is the curated-level
  study mode, not the default review deck. **`?focus=<literal>` always puts that literal first, with or without
  `?level=` and whether or not it belongs to the level's curated list**; `Study this Kanji` never passes `level`.
  An empty queue shows the end-of-deck state (§6), never a placeholder card. Card content comes from the dictionary;
  the post-reveal fields are listed once, in §6 (Hán Việt, English meaning, on/kun; curated `meaning_vi` when
  present).
- Every reference to `user_kanji_progress` / its `kanji_id` (full `git grep` 2026-11-06 — the plan moves all of them):
  - SQL: `review_due_keys` (`20261008000045_port_dashboard.sql:117` emits `'kanji:' || k.kanji_id`, `:135`),
    `20261007000044_port_profile.sql:285` (column-agnostic, re-verify only).
  - App code: `lib/data/srs.ts:14` (`fk: "kanji_id"`) + `getReviewQueue("kanji", level)`;
    `lib/data/badge-snapshot.ts:18-23` (selects `kanji_id` for the learned count); `lib/data/user-export.ts:24`
    (key columns `["user_id", "kanji_id"]`) and `:179-184` (history export join `kanji ( character )`);
    `lib/user-export/tables.ts:38` (erase/export registry, `user_id` — unchanged, re-verify).
  - Mission keys: stored `learning_outcomes.item_key` `'kanji:' || kanji_id` (next bullet). D12's Review mission
    reads `review_due_keys`, so it moves with the SQL above.
  - DB tests: `supabase/tests/account-erasure.sql:9`, `supabase/tests/mission-race/setup.sql:11`,
    `supabase/tests/mission-race/worker.sql:11`, `supabase/tests/port-dashboard.sql:387-654` (seeds by `kanji_id`).
  - Unit tests: `lib/data/srs.test.ts`, `srs-preferences.test.ts`, `gamification.test.ts`, `badge-snapshot.test.ts`,
    `missions-prewrite.integration.test.ts`, `user-export.test.ts`.
  - E2E: `tests/e2e/app-nav.spec.ts:19,106`, `tests/e2e/fixtures/dashboard-data.ts:33,50`.
  - GDPR: rows still cascade on `users` delete (`user_id` FK untouched); the erase gate and the export must pass on
    the new schema.
- Stored mission keys `'kanji:' || kanji_id` (`learning_outcomes.item_key`) are rewritten to `'kanji:' || literal`
  in the same migration (there is no production data yet; the rewrite is one `update … from kanji` and keeps local
  history intact).
- The ring needs a first review: with `reviews = 0` the status card shows stage and next review without the ring.
- "Add to Review" is one-way (no remove path; YAGNI). After adding, the button reads "Đang ôn tập" and is disabled.
  "Study this Kanji" opens the default deck with `?focus=<literal>` first; rating it creates the progress row, which is
  the same as adding it to review.

### 4.4 Favorites
`user_kanji_favorites(user_id → users on delete cascade, literal text, created_at, primary key (user_id, literal))`,
RLS own-rows, copying the `user_saved_collections` pattern (`20260929000034`: select/insert/delete, no update). Endpoints: `PUT/DELETE /api/kanji/favorites/[literal]` (rate-limited like the lookup). The list shows
as a "Kanji đã lưu" strip at the top of `/kanji` (glyph + Hán Việt, links to inspect) — the only existing kanji
surface; Explorer will own it later.

### 4.5 Lessons index (examples + "appears in lessons")
Query `transcript_lines.text_jp like '%<literal>%'` joined to `transcripts → videos`, restricted by RLS to lessons the
learner can see. Examples: up to 3 lines (text, translation, lesson title, `start_time`), linking to the lesson at that
time; "View more examples" loads the next 3. "Appears in lessons": distinct lessons with occurrence counts, top 4,
"See all lessons" → the lesson list filtered by the literal if such a filter exists, else hidden. 977 local lines take
< 10 ms; `// ponytail: seq scan; add a pg_trgm index when transcript_lines grows past ~100k`.

## 5. Inspect (Figma `28:2041`)

### 5.1 Routing
- Canonical full page stays `/kanji/[literal]` (legacy UUID redirect kept).
- **The modal is a query parameter, not an intercepting route** (my call after the builder check): Next 14.2's
  `(.)kanji/[id]` intercept would also match `/kanji/review` (opening a 404 modal from every Review button) and fire
  from `(focus)`/`(immersive)` pages whose layout has no slot. Instead: `?kanji=<literal>` on the current URL. One
  `<KanjiInspectModal>` mounted in the `(protected)` layout reads `useSearchParams().get("kanji")` and opens over any
  protected page — the lesson workspace included (the drawer's existing "view full details" link,
  `kanji-quick-inspect.tsx:125-127`, switches to it). Opening = `router.push` with the param added; Back closes;
  a shared link or refresh shows the same page with the modal open; the modal has a "Mở trang riêng" link to
  `/kanji/[literal]`. A shared helper builds kanji hrefs so every glyph link uses it.
- History rule (pinned):
  - **Opened inside the app** (a glyph link click): `router.push` with `kanji` added, and the opener sets an in-app
    flag (e.g. a module-level/session value recording the pushed URL). Close (Esc, backdrop, ✕) = `router.back()`.
  - **Initial URL already has `?kanji=`** (shared link, refresh, new tab — the flag is absent): close =
    `router.replace` with `kanji` (and `from`) removed; the learner stays on the page underneath, never leaves it.
  - `‹ ›` = `router.replace` (same history entry).
  - Opened from the lesson drawer: closing returns to the lesson exactly as it was — same video position and
    play/pause state, drawer state unchanged. Adding the query param re-renders the server page, so this must be
    proven in the browser before content work, not assumed.
- Modal: native `<dialog>` (`showModal`) → Esc and backdrop close per the history rule above, focus returns to the
  opener (or to the page's main heading when there is no opener, i.e. the initial-URL case). Content loads from the
  existing `/api/dictionary/kanji/[literal]` (extended) so the modal needs no server render.
- `‹ ›` move to the previous/next kanji of the **context list** the modal was opened from (`&from=level:N5` or
  `&from=favorites`); with no context they are hidden. They use `router.replace`.
- Entry points: glyph links on `/kanji` (level lists, "Kanji đã lưu" strip), inside the modal/page itself
  (composition chips), and the lesson drawer's "view full details". The dashboard has **no** kanji glyph link today
  (it only links `/kanji/review`, `components/dashboard/quick-access.tsx:14`), so it is not an entry point.
- Prove it in a real browser before building the content: open from `/kanji` and from the lesson drawer; Back;
  Forward (reopens); refresh; shared link (close stays on the page); ‹ ›; Esc; focus return; video position and
  drawer state preserved after close; and the Review buttons still reach `/kanji/review`.

### 5.2 Content (one component, modal and page)
| Frame block | Data | Notes |
|---|---|---|
| Header | glyph, kana readings line, TTS, meaning line; `♡ Favorite`, `+ Add to Review` | Meaning line = **Hán Việt (uppercase) · English** |
| Stroke order | KanjiVG paths, stroke count, Replay | existing `StrokeOrder` |
| Meaning card | Onyomi / Kunyomi with TTS; **Hán Việt**; English meanings; total strokes, frequency `#n`, grade; badges `常用` (grade ≤ 8), old-JLPT `n級`, curated N-level when present | the frame's `N3` badge only when curated `jlpt_level` exists |
| My status | SRS stage, reviews, next review; ring = (reviews − lapses) / reviews; `Review Now` | whole card replaced by an "Add to Review" prompt when the kanji has no progress row |
| Composition | KanjiVG `components` tree → element chips → the kanji | element meaning from `dict_kanji` when the element is itself a kanji |
| Mnemonic | curated `mnemonic_text` | hidden when empty |
| Nghĩa Hán (Thiều Chửu) | `dict_kanji.tc_lines`, first 2 shown, expandable | new block, not in the frame; placed under the meaning card; credit "Thiều Chửu, Hán Việt tự điển" |
| Common words | top 5 ranked JMdict words: headword, reading, English gloss, TTS | existing data |
| Example sentences / Appears in lessons | §4.5 | each block hidden when empty; an empty state line when both are |
| Bottom actions | Study this Kanji → `/kanji/review?focus=<literal>`; Open Vocabulary, Practice Writing, Find Similar Kanji → `/` placeholder (one PLACEHOLDER constant) | owner rule (2026-10-13, restated 2026-11-06): frame CTAs kept as links — not removed, not plain text, not disabled; unbuilt targets link to `/`. `/vocab` is hidden by A10, so Open Vocabulary has no destination yet |

Theme: the frame is dark; the port uses the app's current tokens and theme (Figma decides composition, the repo
decides tokens). The drawer quick-inspect in the lesson workspace keeps its layout and gains the Hán Việt reading; its
existing "view full details" link opens the modal (§5.1). The video is not paused by the app; the learner controls it.

## 6. Review (Figma `280:1314`)

- Move `/kanji/review` into the `(focus)` group: slim bar `← · Korume | Kanji Practice · <deck label> n / N · ✕ Exit`.
- Deck label: `JLPT N5…N1` when `?level=`, "Ôn tập hôm nay" otherwise; `?focus=<literal>` puts that kanji first.
- Card: badge row, glyph, "Recall the meaning before revealing", `Reveal meaning`. Rating row (Again/Hard/Good/Easy
  with the SM-2 intervals from `lib/srs`) disabled until reveal.
- **Post-reveal state is not drawn.** Content (pinned here, the single source for card fields): Hán Việt (large),
  English meaning, on/kun, curated `meaning_vi` when present, link "Xem chi tiết" → inspect modal; rating row
  enabled; keys 1–4 rate, Space reveals. **Gate (owner ruling 2026-11-06):** the plan has its own step — build a
  complete post-reveal mock (and end-of-deck), send it to the owner, and start the Review implementation task only
  after the owner approves it.
- Footer: today % complete, cards remaining, day streak (existing gamification data), encouragement line.
- End of deck (undrawn): a short summary in the same card (reviewed count, again count) + back to `/kanji`.
- `components/learning/review-session.tsx` is shared with vocab review — the builder decides whether kanji gets its
  own component or the shared one gains the variant; vocab review must not change.

## 7. Proof

- Units: kanjidic `vi` parse; Thiều Chửu lookup (direct, kyūjitai, redirect, redirect to missing target, chained
  redirect, missing); `itemId` validated by `itemType` (a non-kanji string on the kanji branch → 400); queue by
  literal incl. `focus` first with and without `level` and a non-curated focus literal; favorites API (auth, rate
  limit, RLS); `submitReview` reviews/lapses.
- DB gates: migration preserves row count and every column value (§4.3); erase gate covers `user_kanji_favorites`
  and the new progress key; dictionary gate covers `vi_readings` and `tc_lines`; import coverage ≥ 95 % (§4.2).
- E2E: open inspect from `/kanji` (modal) → ‹ › → Esc (focus back on the opener) → Back → Forward (reopens); from the
  lesson drawer (close → same video time, drawer unchanged); refresh / shared link with `?kanji=` (close stays on
  the page); the Review button still reaches `/kanji/review`; `/kanji/日` (page); favorite toggle persists;
  Add to Review → appears in `/kanji/review`; a full review card round (reveal, rate); empty deck → end-of-deck.
- Chrome measure at 1280×529 and 1440×900 against the frames; owner look before merge.

## 8. Left to the builder

Component split, file layout, exact copy (vi/en messages), the post-reveal and end-of-deck mock (within the frame's
vocabulary, owner-approved before the Review task — §6), whether `‹ ›` context uses a query param or session state,
task order (data first is suggested: §4.1 → §4.2 → §4.3 → §4.4 → routing proof → content → review mock gate →
review).

Not reopened (owner 2026-11-06): CTAs link to `/`, kanji SRS identity = literal, default review deck semantics.
