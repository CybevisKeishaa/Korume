# Branch Run State

Branch `shadowing-workspace-1b`.

## Goal and scope

Shadowing workspace Part 1b: the intelligence layer (Utility Drawer, selection popover, ✨ AI explanation in
nine sections, Vocabulary / Grammar / Mining / Notes, KanjiQuickInspect) plus the Knowledge Economy core
(shared cache, single-flight, entitlement, cost ledger, hard global USD budget) and the versioned dictionary
snapshot (JMdict + KANJIDIC2 + KanjiVG). Web only.

## Authorities

- Spec (LOCKED 2026-10-02 after the owner's 5 written-spec corrections): `docs/superpowers/specs/2026-10-02-shadowing-workspace-part-1b-design.md`
- Plan (APPROVED by the owner 2026-10-02): `docs/superpowers/plans/2026-10-02-shadowing-workspace-part-1b.md`
- REFRAME spec (locked `32b5e07`, supersedes the 1b UI scope): `docs/superpowers/specs/2026-10-02-shadowing-workspace-part-1b-reframe-design.md`
- REFRAME plan (`63fdc1f`, tasks R1–R5): `docs/superpowers/plans/2026-10-02-shadowing-workspace-part-1b-reframe.md`
- `AGENTS.md`, `docs/lessons.md`, `.codex/docs/workflow.md` §8

## Accepted commits

- `6148a85` `5f43650` `881af6c` spec (locked at `881af6c`) · plan
- T0–T15 `419c8af`..`62107ca` (Claude inline) · reframe spec `32b5e07` · reframe plan `63fdc1f`

## Contracts and decisions

- Owner rulings R1–R11 in spec §2; deviation register in spec §3.
- 2026-10-02 owner: Codex is busy elsewhere — Claude implements every task inline (no packets). Ledger:
  `.superpowers/sdd/2026-10-02-shadowing-workspace-part-1b/progress.md` (gitignored).
- 2026-10-03 owner: the reframe tasks go to Codex, one packet per `codex exec`
  (`.superpowers/sdd/2026-10-02-shadowing-workspace-part-1b/task-R<n>-brief.md`). Codex never commits; Claude
  reviews, runs mutations and the gates, and commits.

### T0 findings (2026-10-02)

- **KanjiVG:** use `kanjivg-20260714-main.zip` — 6703 files `kanji/<5-hex>.svg`, one per character, no
  variants (the `all`/`r` zips add `-Kaisho` etc.). sha256 `b5df6cd2…a7fc`. 緑 = `kanji/07dd1.svg`, 14
  `<path>` ids `kvg:07dd1-s1…s14`. Elements in the corpus: `svg`, `g`, `path`, `text` (stroke numbers, dropped).
  Attributes: `xmlns`, `xmlns:kvg`, `width`, `height`, `viewBox`, `id`, `style`, `d`, `transform` (text only),
  `kvg:element|variant|partial|original|part|number|tradForm|radicalForm|position|radical|phon|type`. Every
  `d` matches `[MmLlHhVvCcSsQqTtAaZz0-9., -]`. Header licence: CC BY-SA 3.0, Ulrich Apel,
  http://kanjivg.tagaini.net; version `20260714`.
- **JMdict:** `http://ftp.edrdg.org/pub/Nihongo/JMdict_e.gz` → `DataKanji/JMdict_e.gz`, `JMdict created: 2026-10-02`,
  218849 `<entry>`, sha256 `0606397c7e8fdde67cca199168dac75422002cfe39f9dcdca644c4fab9dca94a`.
- **KANJIDIC2:** `http://ftp.edrdg.org/pub/Nihongo/kanjidic2.xml.gz`, `database_version 2026-225`
  (created 2026-08-13), 13108 `<character>`, sha256 `05c10cb87dc109e087f6e99c95a8fb8dd02705cbd0e86130ba0e80bf8db7fa26`.
- **EDRDG licence** (neither file header states one): https://www.edrdg.org/edrdg/licence.html — "The dictionary
  files are made available under a Creative Commons Attribution-ShareAlike Licence (V4.0)."
- **Haiku price** (`fast` tier = `claude-haiku-4-5-20251001`, `lib/ai/providers/anthropic.ts:15`): $1.00 input,
  $5.00 output, $0.10 cache-read per MTok (claude-api skill, cached 2026-09-25).
- **Seams:** export = `lib/user-export/tables.ts` (`{ table, userColumn: "user_id" }` after `sentence_marks`)
  + `PRIMARY_KEY_COLUMNS` in `lib/data/user-export.ts`; deletion = `lib/account-deletion/erase.ts:201` deletes
  the `users` row → `on delete cascade` covers notes.
- **Selection over ruby (Step 4)** not probed in Chrome: Correction 3 is visible in code; the jsdom tests in
  T11 and the Chrome pass in T15 cover it.

## Verification

- R1 lexical line analysis: focused tests, TypeScript, and protocol verification passed (2026-10-03).
- R2+R3 (Codex R2, R3a part; Claude finished R3a + R3b after the Codex quota): tsc/lint/protocol 0, vitest 482/4351, 8 mutations RED, code-reviewer 0 Critical.
- R2 drawer Inspector reducer: focused tests and protocol verification passed; TypeScript has the expected R3-only consumer errors (2026-10-03).

## Working tree and environment

- Owner: Claude
- Worktree `.worktrees/shadowing-workspace-1b`, branched from master `13e9ab9`.
- Dictionary sources on the owner's machine: `C:/Users/tplon/Desktop/Japan/Korume/DataKanji/`
  (`kanjidic2.xml.gz`, `kanjivg-20260714-{all,main,stripped}.zip`, `kanjivg-r20260714.zip`). JMdict not yet
  downloaded (T0).

## Blockers

- None.

## Next actions

- R1 (Codex) → R2+R3 → R4 → R5 (e2e/Chrome by Claude) → original T16a/T16b.
