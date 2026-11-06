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

## Contracts and decisions

- No model-produced Vietnamese meaning text; values only from KANJIDIC2 or licensed sources.
- Migration numbers shifted +1 (054 = activate-analyze): progress literal 055, favorites 056, lesson index 057.
- Kanji lapse = quality below the SM-2 pass threshold (0–2).
- The shared local DB already carries migration 055 (owner-approved); master code in the main checkout errors on
  kanji/dashboard until this branch merges.
- SRS (owner 2026-11-06): keep `lib/srs/sm2.ts` for kanji review; rating buttons show no interval sublabel (spec §6);
  Anki learning steps / FSRS deferred to a separate evaluation. Post-reveal mock revised accordingly; owner approval
  of the Task 8 mock pending.
- "See all lessons" link NOT rendered: `/shadowing?q=` is applied by `getShadowingHub` as `ilike("title", ...)` on video titles only (lib/data/shadowing-hub.ts:138), not transcript text.

## Verification

- `npx vitest run lib/dictionary lib/data lib/validation --minWorkers=1 --maxWorkers=2`
- `npm run verify:db:dictionary`, `npm run verify:db:kanji`, `npm run verify:db:dashboard`, `npm run verify:db:erasure`

## Working tree and environment

- Owner: Claude

## Blockers

None. Owner gate at Task 8 (post-reveal mock).

## Next actions

Close Task 3 review, then Task 4 (favorites + add to review).
