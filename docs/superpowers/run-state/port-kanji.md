# Branch Run State

## Goal and scope

port-kanji: Kanji inspect modal + review, Han-Viet readings, Thieu Chuu. Branch `port-kanji`.

## Authorities

- Spec: docs/superpowers/specs/2026-11-06-port-kanji-design.md
- Plan: docs/superpowers/plans/2026-11-06-port-kanji.md

## Accepted commits

- Task 1: Han-Viet readings from KANJIDIC2 + dict import --force (`28c5d684`, fix `f7157bb6`).
- Task 2: Thieu Chuu lines resolved at import, license-gated (`772ae5f0`).
- Task 3: SRS progress keyed by literal (`9428cce3`), review clean.
- Task 4: favorites + add to review (`56452f7d`), review clean.
- Task 5: lesson examples + appears-in-lessons (`3dec3dda`), review clean.
- Task 6: inspect modal as a `?kanji=` param (`e332073c`, fix `5ef57f36`), review clean after 1 fix round.
- Task 7: inspect content from the 28:2041 frame (`c37e2288`), review clean — owner decisions pending (below).
- Task 8: post-reveal mock approved by the owner 2026-11-06 (no interval sublabels; SM-2 kept).
- Owner decisions K1–K9 recorded in spec §9 + decision-register §3c (`42c5e912`).
- Task 7b: owner decisions K10–K15 on the inspect (`ea90aa0f`, fix `05180e33`), review clean.
- Task 9: kanji review in `(focus)` (`384348d6`, fix `ffb6a178`), review clean.
- Task 9b: kanji motion (`5f7f846d`, fix `e2bf75e9`), review clean.
- Task 10: Thiều Chửu cleared + credit links its source (`28b29309`); whole-branch review (Opus) fixes `229fbb33`;
  gate fixes `6fdf199c` (ICU plurals, token-scale) and `2de6b9b5` (E2E on the new review UI).

## Contracts and decisions

- No model-produced Vietnamese meaning text; values only from KANJIDIC2 or licensed sources.
- Migration numbers shifted +1 (054 = activate-analyze): progress literal 055, favorites 056, lesson index 057.
- Kanji lapse = quality below the SM-2 pass threshold (0–2).
- The shared local DB already carries migration 055 (owner-approved); master code in the main checkout errors on
  kanji/dashboard until this branch merges.
- SRS (owner 2026-11-06): keep `lib/srs/sm2.ts` for kanji review; rating buttons show no interval sublabel (spec §6);
  Anki learning steps / FSRS deferred to a separate evaluation. Post-reveal mock approved.
- Task 7 inspect content (owner 2026-11-06 addenda): ONE viewport, no page/dialog scroll at 1280×529 and 1440×900,
  type only on the `--text-*` tokens, no motion, every §5.2 block kept. Layout: header (‹ › · glyph · TTS · kana line ·
  HÁN VIỆT · English · ♡ · + Review · ⤢ page · ✕) / four columns — stroke order + my status | meaning + composition |
  Thiều Chửu + mnemonic | Words / Examples / In lessons tabs (examples page 3 at a time in place) / four CTAs +
  one-line dictionary credit. Thiều Chửu moved beside the meaning card, not under it (no height under it at 529).
  Long content scrolls only inside its own block (Thiều Chửu lines, mnemonic, a tab list, composition chips).
- Dictionary credit on the inspect is `DictionaryAttribution compact`: one line, licence short names visible (K10).
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

- K16 (owner 2026-11-07, after the Chrome look): Thiều Chửu reads too archaic for most learners — it is NOT shown
  anywhere any more (no "show old meaning" toggle). The Vietnamese meaning is hvdic "Từ điển phổ thông" (short modern
  glosses; data via KanjiDictVN `hvcache/` pinned `d95c2bff`), reading-matched to the KANJIDIC2 Hán Việt, kyūjitai
  fallback, curated `meaning_vi` first, then an override file. Licence is not a gate (owner: "không cần có license,
  nguồn đủ là được"); credit "Từ điển Hán Nôm (hvdic.thivien.net)" shown anyway. Gaps (16 jōyō without a gloss) and
  glosses that mislead for Japanese (e.g. 駅 "ngựa trạm", 図 "vẽ, mưu toan") are drafted by Claude in a sheet the owner
  reviews before import — owner-approved exception to the no-model-Vietnamese rule, only via that review.

## Verification

Tip `2de6b9b5` (2026-11-07): typecheck 0, lint exit 0, verify:protocol valid, verify:db kanji / dictionary / dashboard /
erasure / profile PASS; full vitest 6855/6858 → the 3 branch-made reds fixed (`6fdf199c`, 703 targeted green); full
Playwright 253 passed, branch-made reds fixed and re-run green (app-nav 12/12, dashboard, kanji-inspect, summary 5).
Not this branch (it touches none of these areas): landing-page :287/:608/:700/:751, summary :29 and
shadowing-intelligence 5 (AI-on `.env.local`), route-group-provider-identity (no "E2E Seed Video" on /shadowing in the
local DB), korume 1 (flaky, green on re-run).

Open after merge (owner / backlog): xp_events.source_id not re-keyed by 055; quick inspect fetches the full inspect
payload; ~34 old-JLPT kanji without Thiều Chửu lines + the `redirect-unresolved` list; deferred minors in the SDD ledger.

## Working tree and environment

- Owner: Claude

## Blockers

None. Owner answered the Task 7 decisions 2026-11-06 ("Đồng ý" to every recommendation):
- K10 credit: the inspect credit line shows each licence name in visible text (CC BY-SA asks for it), still one line.
- K11 Thiều Chửu stays beside the meaning card (spec §5.2 "under" superseded).
- K12 long text may scroll inside its own block; the page/dialog never scroll; every inner scroller is
  keyboard-reachable (tabIndex 0 + accessible name).
- K13 composition chip gloss stays truncated; the full text shows on hover AND focus.
- K14 `/kanji/[id]` fills the viewport (fill + scale, L-051); owner licence: where a screen has empty space,
  Claude may add useful content of its own design, e.g. ways on to other screens (review, level list, favorites,
  lessons) — real hrefs only, `PLACEHOLDER_HREF` where no target exists, no fabricated data.
- K15 no mnemonic image / lesson thumbnails (no data, never fabricated); glyph reaches the frame's 48 px at 1440.

## Next actions

Owner Chrome look of the inspect (modal + `/kanji/[literal]` page), review (`/kanji/review`, `?level=N5`) and the
motion; merge only on the owner's word. Owner still to run: removal of the 5 merged worktrees.
