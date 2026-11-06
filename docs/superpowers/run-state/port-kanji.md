# Branch Run State

## Goal and scope

port-kanji: Kanji inspect modal + review, Han-Viet readings, Thieu Chuu. Branch `port-kanji`.

## Authorities

- Spec: docs/superpowers/specs/2026-11-06-port-kanji-design.md
- Plan: docs/superpowers/plans/2026-11-06-port-kanji.md

## Accepted commits

- Task 1: Han-Viet readings from KANJIDIC2 + dict import --force.

## Contracts and decisions

- No model-produced Vietnamese meaning text; values only from KANJIDIC2 or licensed sources.

## Verification

- `npx vitest run lib/dictionary --minWorkers=1 --maxWorkers=2`, `npm run verify:db:dictionary`.

## Working tree and environment

- Owner: Claude

## Blockers

None.

## Next actions

Task 2 (fills `dict_kanji.tc_lines`).
