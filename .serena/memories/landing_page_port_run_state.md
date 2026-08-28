# Landing page port (`/`) — run state

> **Status: EXECUTION IN PROGRESS. 7 of 13 tasks built, reviewed and committed on branch
> `landing-page-port`. Nothing merged.** Paused at the user's request 2026-08-28.
>
> ⚠️ **This memory is navigation, process and the decisions I took on the user's behalf. It
> deliberately does NOT restate the design or the plan.** The spec and the plan travel with the repo;
> this does not. If this file and either of them disagree, they win and this file is the bug.

# ▶▶ RESUME HERE

**Next action: Task 8 (§5 Recommendation). BASE is `3f6f00c`.**
Its brief is not yet generated — run
`bash <superpowers>/skills/subagent-driven-development/scripts/task-brief docs/superpowers/plans/2026-08-27-landing-page-port.md 8`

**Execution mode is subagent-driven** (user, 2026-08-27): a fresh implementer per task, a task review
after each, a fix loop, then a whole-branch review at the end. Re-enter with the
`superpowers:subagent-driven-development` skill — it will find the ledger and resume.

## ⚠️ THE FULL RECORD IS GIT-IGNORED AND DOES NOT TRAVEL

`.superpowers/sdd/2026-08-27-landing-page-port/progress.md` is the SDD ledger: every task's commits,
every review's findings, every ruling with its cost-if-wrong, and every deferred minor. It is far
more detailed than this memory and it is **gitignored** — it exists only on this machine and dies
with the working copy. **Read it first on resume.** The task briefs and reports sit beside it.

## Where execution stands

Branch `landing-page-port`, cut from master, **nothing merged**. Two doc commits (`81a20c9` spec,
`bfdb070` plan, `952006c` memory) then 14 implementation commits, `ef616a8`..`3f6f00c`.
Count them with `git rev-list --count 952006c..landing-page-port` (`L-002` — do not record counts).

| Task | What | Fix rounds |
|---|---|---|
| 1 | `marketing.json` catalog, en + vi | 1 |
| 2 | `Section` + `AssetSlot`, Rule #0 scan extended | 1 |
| 3 | §0 nav + §10 footer | 1 |
| 4 | §1 hero | 2 |
| 5 | §2 problem + constellation | 0 |
| 6 | §3 journey | 1 |
| 7 | `lib/pitch/plot.ts` extraction + §4 pitch | 1 |

Tasks 8–13 remain: §5 recommendation, §6 capability chain, §7 trust, §8 CTA + §9 sign-off, the page
composition + Playwright spec, then the density/reduced-motion/a11y sweep.

**Merged-master gate is NOT yet run.** State at `3f6f00c`, measured: `npm run typecheck` zero errors
(clear `tsconfig.tsbuildinfo` first — `"incremental": true` was once observed reporting a false
green), working tree clean. Re-measure test counts rather than trusting any recorded figure.

## Patterns that review established — reuse, do not re-derive

These were paid for with fix rounds. Every remaining section dispatch must carry them.

1. **Translator-as-prop.** `components/marketing/translator.ts` exports `Translator` and its docstring
   is the authority. The section's top component is `async` and calls `getTranslations("marketing")`
   **once**; every sub-component is a plain synchronous function taking `{ t }`. Task 4 originally
   wrote `const child = await Child()` to satisfy the test renderer — bending production shape to
   suit jsdom was rejected, and eight sections would have copied it.
2. **A catalog-coverage guard per section**, mutation-checked. Walk the section's subtree of the EN
   catalog, assert an explicit total-leaf count, and assert **each leaf's text is in the rendered
   DOM** — a count proves only what was iterated. This exists because Task 3 silently dropped two
   footer keys the frame carries. `problem.test.tsx` and `pitch-showcase.test.tsx` are the best
   examples.
3. **`AssetSlot` for every image, no substitutes** — no gradient, no solid block, nothing sliced from
   `346:6275`, and **no scrim laid over a pending placeholder** (one was removed from the hero for
   softening the "unmistakably unfinished" signal).
4. **`theme.extend.spacing` EXTENDS Tailwind's default numeric scale.** So `basis-56`, `h-8`,
   `max-w-md` silently resolve to hardcoded rem and are the same defect class as `p-6`. The Rule #0
   scan **cannot** catch them — its regexes only match bracketed numeric literals — so a green scan
   is not evidence of token compliance.
5. **Vitest resolves `next-intl/server` to `test/stubs/next-intl-server.ts`** (the real build is
   gated behind a `react-server` condition jsdom never sets). It serves **English only** and now
   **throws** on any other locale, deliberately: it used to accept and silently ignore a `locale`
   option that ~40 `app/**` call sites pass, which would have let a Vietnamese assertion pass against
   English strings.

## Rulings I made on the user's behalf — review these

Each cost-if-wrong is in the ledger. The three most likely to be overturned are marked ⚠️.

- ⚠️ **The footer's mascot card and its five 13px icons are NOT implemented.** Spec §5.3 enumerates
  exactly four mascot placements (§1, §4, §6, §8) and the footer is not among them; Task 1 catalogued
  no string for it; its "Say hello to Korume" button would be an affordance with no destination,
  which §2.3 forbids. I read ruling 3's "footer content may not change" as governing the ten
  destinations and the blocks of copy, **not decorative imagery**.
- ⚠️ **"Save Sentence" ships as inert text** in §1's sentence rail, and `hero.saveSentence` was added
  to both locales mid-branch. The brief enumerates it and says §1's composition is the reference's,
  not the frame's; §2.3 says such an affordance ships *as text*, not omitted.
- ⚠️ **The six-link nav is hidden below `md` with no hamburger — deferred to Task 13.** Real
  (`CLAUDE.md` §2 rule 5), but a design decision with several valid answers, and nothing downstream
  depends on it. **Mobile visitors currently reach no marketing destination.**
- **Newsletter block ships as copy with NO live form.** No `<input>`, no `<form>`, no
  `footer.newsletter.placeholder` key — there is no signup endpoint (`EMAIL_PROVIDER=none`) and §2.3
  forbids placeholder affordances. Three keys were added: `footer.newsletter.heading`,
  `footer.closing`, `footer.backToTop`.
- **`footer.copyright` keeps `{year}` and gained the frame's missing "· All rights reserved"**,
  stored sentence-cased (casing is presentation).
- **`recommend.video.jp` ships the brief's 「朝の通勤ラッシュ」, not frame node `347:6778`'s
  「雨の通り ラッシュ」** — the frame's string is not idiomatic and does not pair with
  `recommend.video.en` = "Morning Commute in Tokyo".
- **`hero.sentence.jp`'s U+0020 was removed.** The space IS in frame node `347:6369` — a highlight
  boundary leaking from layout into content. `静か` is now wrapped in the component, derived from
  `keyWords.quiet.jp`.
- **A frame inconsistency was ported, not corrected:** transcript line 1 (`347:6405`) disagrees with
  the sentence rail's "1 / 29" (`347:6369`). The frame is the source.
- **The catalog beat the brief on transcript lines** — the frame and catalog carry two, the brief
  described three. The brief was the stale party.
- **`components/video-player/pitch-contour-overlay.tsx` was left alone** — its maths is a genuinely
  different function (two pre-aligned semitone series, no `refHz`, ranged over their union for a
  shared y-scale), so forcing it through `toPlotPoints` would be wrong. But it duplicates
  `MIN_SEMITONE_SPAN = 4` and the pad-and-floor rule → **sent to the whole-branch review as a named
  item with the fix already specified** (`export function semitoneRange(values)` in `plot.ts`, called
  by both; ~15 lines + a test). Until then, tuning that constant in one place silently desyncs the
  player's two pitch views.
- **Rule #0 does not cover sizing utilities** (`h-3`, `w-8`); widening it needs sizing tokens to
  exist, which is a repo-wide decision.

## Two measurement techniques worth keeping

- **Verifying copy against Figma without `get_design_context`:** `get_metadata` truncates text-node
  names at exactly 50 characters, so an exact match on the first 50 verifies a longer string. Used to
  close a reviewer's ⚠️ on `hero.heading`, `problem.heading`, `trust.cards.ai.body`.
- **A reviewer mutation-checked a test analytically**, without touching the tree, by recomputing
  `toPlotPoints` both ways — and proved the plan's own supplied test could not fail. The pattern
  generalises: ask "what would this assertion do if the behaviour were deleted?"

## Owed to the user

- **The whole Vietnamese catalog**, in one review pass. Parked nits: `.en` gloss keys were translated
  rather than left English; `"13 min"` → `"13 phút"`; `transcript` → `"Lời thoại"` where the product
  ships `"Phụ đề"`; `"Giữ lại"` vs the shipped `"Bộ sưu tập"`; and five register nits the reviewer
  listed for §2/§6/§8.
- **The five photographs.** Still the reason `AssetSlot` exists.
- **§5's "i+1 Perfect Next Step" badge and topic chips** — in the reference, absent from the frame's
  text layers. A question, not a gap.
- **Discord / Facebook / TikTok URLs**, and whether either app-store block should become a link.
- **Whether to delete `public/mascot/renders/` and `assets/blender/references/`** now Blender is
  rejected.
- A **browser pass**: the Companion card's column (frame puts it right of the rail, the build puts it
  under the transcript — the brief's own ordering supports the build), and whether §4's and §3's SVGs
  get non-zero height from `viewBox` alone (they carry no CSS height by design — carried to Task 13).

## Carried into later tasks

- **Task 12** (Playwright): assert §3's five cards render as a **row**, not a column — jsdom cannot,
  so a `flex-col` mutant currently passes.
- **Task 13**: the mobile nav ruling above; the SVG-height browser check; and note that §2's
  constellation satisfies reduced-motion **vacuously** (it has no animation) — if Task 13 adds any,
  the gate becomes a real requirement.
- **Whole-branch review**: the `semitoneRange` item; the untokenized cluster (`h-16`, `max-w-xl`,
  `tracking-widest`, `mx-auto`, `max-w-md` across six files); `${id}-heading` duplicated in
  `section.tsx` and `journey.tsx` (a `CLAUDE.md` §6 "one fact, two homes", guarded by test but not
  derived — fix is to export `headingIdFor(id)`); the footer coverage guard excluding by leaf **name**
  rather than path; and `waveform.test.tsx`'s canvas draw-count flake under parallel load.

## Still true from the 2026-08-26 ruling — do not re-open

`347:6277` IS the design for `/` · the authenticated home stays `dashboard` at `/dashboard` ·
the frame's footer and its "A quieter way to keep going." section win over the reference ·
`346:6275` is the visual quality bar, stays out of the registry, and **must NOT be deleted** ·
imagery is AI-generated so there is no licensing question · **P13** PayOS only · **P14** auth is
email + Google + Apple, GitHub no · **Blender mascot renders are REJECTED**; §1/§4/§6/§8 use
`public/mascot/Korume.png` with `mix-blend-mode: screen`.
