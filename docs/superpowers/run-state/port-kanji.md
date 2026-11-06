# Branch Run State

## Goal and scope

port-kanji: Kanji inspect modal + review, Han-Viet readings, Thieu Chuu. Branch `port-kanji`.

## Authorities

- Spec: docs/superpowers/specs/2026-11-06-port-kanji-design.md
- Plan: docs/superpowers/plans/2026-11-06-port-kanji.md

## Accepted commits

- Task 1: Han-Viet readings from KANJIDIC2 + dict import --force (`28c5d684`, fix `f7157bb6`).
- Task 2: Thieu Chuu lines resolved at import, license-gated (`772ae5f0`).
- Task 3: SRS progress keyed by literal (`9428cce3`) — review pending.
- Task 7: inspect content from the 28:2041 frame — see the measure below.

## Contracts and decisions

- No model-produced Vietnamese meaning text; values only from KANJIDIC2 or licensed sources.
- Migration numbers shifted +1 (054 = activate-analyze): progress literal 055, favorites 056, lesson index 057.
- Kanji lapse = quality below the SM-2 pass threshold (0–2).
- The shared local DB already carries migration 055 (owner-approved); master code in the main checkout errors on
  kanji/dashboard until this branch merges.
- SRS (owner 2026-11-06): keep `lib/srs/sm2.ts` for kanji review; rating buttons show no interval sublabel (spec §6);
  Anki learning steps / FSRS deferred to a separate evaluation. Post-reveal mock revised accordingly; owner approval
  of the Task 8 mock pending.
- Task 7 inspect content (owner 2026-11-06 addenda): ONE viewport, no page/dialog scroll at 1280×529 and 1440×900,
  type only on the `--text-*` tokens, no motion, every §5.2 block kept. Layout: header (‹ › · glyph · TTS · kana line ·
  HÁN VIỆT · English · ♡ · + Review · ⤢ page · ✕) / four columns — stroke order + my status | meaning + composition |
  Thiều Chửu + mnemonic | Words / Examples / In lessons tabs (examples page 3 at a time in place) / four CTAs +
  one-line dictionary credit. Thiều Chửu moved beside the meaning card, not under it (no height under it at 529).
  Long content scrolls only inside its own block (Thiều Chửu lines, mnemonic, a tab list, composition chips).
- Dictionary credit on the inspect is `DictionaryAttribution compact`: source + version links, licence in the link
  `title` (the full inline licence text took 3 lines). Owner to confirm this is enough credit; quick inspect unchanged.
- "See all lessons" link NOT rendered: `/shadowing?q=` is applied by `getShadowingHub` as `ilike("title", ...)` on video titles only (lib/data/shadowing-hub.ts:138), not transcript text.

## Task 7 measure (Playwright in a real Chromium, prod build of this worktree, learner fixture, vi locale)

Frame `28:2041`: modal 974 wide in a 1278 frame (76.2 %), header 88.7, body 1208.8 (scrolls), footer 72.7; row 1 three
equal cards (stroke | meaning | status), row 2 composition | mnemonic, words 5-up, examples | lessons, 4 CTAs.

| kanji | viewport | modal w (ratio) | dialog h | dialog scroll ≤ client | page scrollH ≤ innerH | blocks past footer |
|---|---|---|---|---|---|---|
| 日 | 1280×529 | 973 (76.0 %) | 490 | 488 ≤ 488 | 529 ≤ 529 | none |
| 日 | 1440×900 | 1094 (76.0 %) | 548 | 546 ≤ 546 | 900 ≤ 900 | none |
| 語 | 1280×529 | 973 | 515 | 513 ≤ 513 | 529 ≤ 529 | none (TC list 199/146, mnemonic 39/30 scroll inside) |
| 語 | 1440×900 | 1094 | 632 | 630 ≤ 630 | 900 ≤ 900 | none |
| 学 | 1280×529 | 973 | 491 | 489 ≤ 489 | 529 ≤ 529 | none |
| 学 | 1440×900 | 1094 | 548 | 546 ≤ 546 | 900 ≤ 900 | none |

Header 72 / footer 88 at 1280 (frame 88.7 / 72.7 at 1278 — our footer carries the credit line). Column widths at 1280
modal: 182 | 262 | 216 | 250 (weights 0.8 / 1.15 / 0.95 / 1.1; frame row 1 is 3 × 287).
Type (computed, 1280 → 1440): glyph display 35.6 → 40 (frame 48, line box 1.4 exempt `kanji-inspect-glyph`); meaning
line body 12.4 → 14 semibold (frame 12 bold); block labels caption 11 → 12 sentence case (frame 10 bold caps); card
text body 12.4 → 14 (frame 14 / 12); CTA label body 12.4 → 14 semibold (frame 12 bold), hint caption 11 → 12 (frame 10).
Deltas kept: no mnemonic image and no lesson thumbnails (no data); composition chips show Hán Việt · English truncated
(full text in the chip title, chip opens that kanji); no radical/component tag (KanjiVG import keeps no such flag);
"See all lessons" not rendered (above). E2E `kanji-inspect.spec.ts` test 9 re-proves the no-scroll rule on 語 and 学.

## Verification

- `npx vitest run lib/dictionary lib/data lib/validation --minWorkers=1 --maxWorkers=2`
- `npm run verify:db:dictionary`, `npm run verify:db:kanji`, `npm run verify:db:dashboard`, `npm run verify:db:erasure`

## Working tree and environment

- Owner: Claude

## Blockers

None. Owner gate at Task 8 (post-reveal mock).

## Next actions

Close Task 3 review, then Task 4 (favorites + add to review).
