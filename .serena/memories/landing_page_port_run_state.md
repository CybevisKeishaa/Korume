# Landing page port (`/`) — run state

> **Status: EXECUTION IN PROGRESS. 7 of 13 original tasks + Task M/R built and committed on branch
> `landing-page-port`. Nothing merged.** Paused at the user's request 2026-08-28 (second pause).
>
> ⚠️ **This memory is navigation, process and the decisions taken on the user's behalf. It
> deliberately does NOT restate the design or the plan.** The spec and the plan travel with the repo;
> this does not. If this file and either of them disagree, they win and this file is the bug.

# ▶▶ RESUME HERE

**BASE is `978af38`.** Two things are open, and the FIRST ONE NEEDS THE USER TO SEQUENCE IT:

1. **Task A — motion vocabulary + the §2/§3/§4 expressiveness retrofit.** New, from the user's
   review of the built page on 2026-08-28. Written up as **spec §13 (G5)** — read that first, it is
   the authority. Not yet planned or scheduled.
2. **Task 8 (§5 Recommendation)** and onward, each now built to §13's bar.

**My recommendation, which the user has NOT ruled on: do Task A before Task 8.** §13.1(5) asks for
one motion vocabulary reused across sections, not four independent effects; building it first gives
Tasks 8–11 primitives to consume, the same shape as `section.tsx` for rhythm and `lib/pitch/plot.ts`
for the contour maths. It also matches `mem:korume-shared-infra-preference`. Doing Task 8 first
means §5 invents its own motion and is then reworked. **Put it to the user.**

**Execution mode is subagent-driven** (user, 2026-08-27). Re-enter with
`superpowers:subagent-driven-development`; it will find the ledger and resume. Two exceptions
already established: work that turns on the controller's own visual judgement (pose choice, matte
quality) was done by the controller, not delegated — the user asked for that directly.

## ⚠️ THE FULL RECORD IS GIT-IGNORED AND DOES NOT TRAVEL

`.superpowers/sdd/2026-08-27-landing-page-port/progress.md` is the SDD ledger: every task's commits,
every review's findings, every ruling with its cost-if-wrong, every deferred minor. It is far more
detailed than this memory and it is **gitignored** — it exists only on this machine and dies with
the working copy. **Read it first on resume.** Task briefs and reports sit beside it.

## Where execution stands

Branch `landing-page-port`, cut from master, **nothing merged**. Tasks 1–7 (`ef616a8`..`3f6f00c`),
then Task M/R (`2fefd12`, `033368d`, `edfc1b9`), then the §13 ruling (`978af38`).
Count commits with `git rev-list --count 952006c..landing-page-port` (`L-002` — do not record counts).

| Task | What | Fix rounds |
|---|---|---|
| 1–7 | catalog · primitives · §0+§10 · §1 · §2 · §3 · `lib/pitch/plot.ts`+§4 | see ledger |
| M/R | mascot pipeline + 5 poses; footer mascot card; the user's four overturned rulings | 0 |

Still to build: §5, §6, §7, §8+§9, the page composition + Playwright spec, the density/a11y sweep,
**Task A** (motion), and **Task V** (visual fidelity vs `346:6275`).

Gate at `978af38`, measured: tsc 0 errors, lint 0 errors, 274 files / 2455 tests. Clear
`tsconfig.tsbuildinfo` before any typecheck after a `messages/**` change. Re-measure counts rather
than trusting any recorded figure.

## ▶ THE MOST IMPORTANT THING THIS RUN LEARNED (2026-08-28)

The user looked at the built page and judged §2/§3/§4 **correct but lifeless** — §2's composition
"xấu hẳn so với ảnh png… nhìn khô", and the linework (constellation rays, step arrows, above all
the pitch contour) flat where the reference is expressive.

**No gate in the plan could have caught it, and that is the lesson, not the defect.** All three
sections passed their reviews; §2 passed with zero fix rounds, the only one in the run. A
catalog-coverage guard proves a string reached the DOM. The Rule #0 scan proves no hardcoded number.
jsdom does no layout at all. The §4.1 reviewer checks — decorative, aria-hidden, unreachable,
motion-gated, content-preserving — all genuinely held. **Every one of those is satisfied by a
section that is correct and dead.** Adding assertions would not have found this; a human looking at
the page did. Treat "structurally present and correctly hidden" as the floor for decorative
elements, never the bar.

Corollary now written into spec §13.1(4): §2's constellation passes reduced-motion **vacuously**
(it has no animation). A vacuous pass on a decorative element is evidence the element is inert, not
evidence it is safe.

## Patterns that review established — reuse, do not re-derive

1. **Translator-as-prop.** `components/marketing/translator.ts` is the authority. Section top
   component is `async` and calls `getTranslations("marketing")` **once**; every sub-component is a
   plain synchronous function taking `{ t }`. Never `await Child()` to satisfy jsdom.
2. **A catalog-coverage guard per section**, mutation-checked: explicit total-leaf count **and**
   per-leaf DOM presence. Exclude by **path**, never by leaf name (that bug was real and is fixed).
3. **`AssetSlot` for every pending image** — no gradient, no solid block, nothing sliced from
   `346:6275`, and no scrim over a pending placeholder.
4. **`theme.extend.spacing` EXTENDS Tailwind's default numeric scale**, so `basis-56`, `h-8`,
   `max-w-md` are hardcoded rem and the Rule #0 scan **cannot** see them. A green scan is not
   evidence of token compliance. Giving `next/image` explicit width/height sidesteps it entirely.
5. **Vitest maps `next-intl/server` to `test/stubs/next-intl-server.ts`**, English only, and it
   **throws** on any other locale — deliberately.

## Mascot: what exists now (spec §5.3 is SUPERSEDED, §5.3's own header says so)

`scripts/mascot/` cuts poses out of the character sheets; `poses.json` is both the manifest and the
provenance record §5.2 demands; `poses.test.ts` pins it to disk, mutation-checked both ways.
Dependency-free by design (PNG over `zlib`). **Five poses, one narrative thread**: waves hello §1 ·
takes notes §4 · holds a memory §6 · looks ahead §8 · sleeps §10. `mix-blend-mode: screen` is retired.
`holding-memory.png` and `looking-ahead.png` are already cut — Tasks 9 and 11 just consume them.

**Method worth keeping:** nothing thresholds on luminance (cream character on cream ground); the
ground is whatever a border-seeded flood fill reaches. Composite a cutout on **magenta** to tell a
real see-through gap from a matte failure — on a dark page they look identical.

## Rulings — the user's own, 2026-08-28, NOT re-litigable

- **Mascot**: per-placement hand-picked poses, real alpha, five placements. Overturns spec §5.3.
- **Footer mascot card ships.** Both my objections were wrong and the frame's own metadata proved it:
  `ButtonSayHelloToKorume` (`347:7100`) has NO visible label — that is a layer name — and its two
  real labels were already in the catalog. **When I rule something out for "no copy exists", the
  frame's metadata is the control.**
- **"Save Sentence"** → `/mining` (registry label "Collection"). Protected; sign-in redirect is fine.
- **Store affordances** → the stores' own front pages via `lib/app-stores.ts`. App is not published;
  the user ruled with that stated. Mobile shows **both** stores — a server component cannot guess
  the platform. Confirmed by the user as not crowding at narrow width.
- **Vietnamese copy: the user will do it themselves.** DO NOT create a task, write a report, or edit
  `messages/vi/marketing.json` copy. One string added this session needs their eye:
  `footer.mascot.cta` = "Chào Korume một tiếng". Older parked nits are in the ledger.

## Motion: what is already there — DO NOT ADD A DEPENDENCY

`gsap@^3.12.5`, `lenis@^1.1.13`, `framer-motion@^11.5.4` are **already installed**, plus
`lib/gsap.ts` (lazy `registerGsap()` + ScrollTrigger, its doc comment already naming "landing
storytelling"), `components/motion/reveal.tsx`, `smooth-scroll.tsx`, and `stroke-order.tsx` with a
test — a worked, shipping example of a scroll-driven animation. Task A extends this.

**Two constraints found by reading that code:**
1. Reduced motion here is a **JS check** (`useTheme().reduceMotion`), not a CSS media query, and
   `Reveal` returns plain content when set. Correct shape; copy it. A `motion-reduce:` variant is
   not interchangeable with it.
2. `Reveal` is `"use client"` and every marketing section is an **async server component**. A
   section cannot just become a client component — it would lose `getTranslations`, and the
   translator is not serialisable. Expect: server section renders content, thin client wrapper
   animates it.

## Reference `346:6275` — pulled and read this session (855×1800)

Closed two open questions: the §1 **Companion card sits UNDER the transcript** (the build is right,
the frame was the outlier), and **§5 does carry the "i+1 Perfect Next Step" badge and topic chips**
(Task 8 builds them; not a question for the user). Also visible: the reference's accent is a strong
**orange**, and its footer has no newsletter, no store badges and no mascot card — those are all
frame, and ruling 3 keeps the frame's footer. Recorded so Task V does not "fix" it backwards.

## Still owed to the user

- **The five photographs.** Still the reason `AssetSlot` exists.
- **Discord / Facebook / TikTok URLs.**
- **Whether to delete `public/mascot/renders/` and `assets/blender/references/`** now Blender is
  rejected.
- Sequencing Task A vs Task 8 (above).

## Carried into later tasks

- **Task 12** (Playwright): assert §3's five cards render as a **row**, not a column — jsdom cannot,
  so a `flex-col` mutant passes today.
- **Task 13 / V**: whether §4's and §3's SVGs get non-zero height from `viewBox` alone; the five
  poses' on-page display sizes (44px hero, 96px pitch, 112px footer) — jsdom does no layout.
- **Whole-branch review**: `export function semitoneRange(values)` in `plot.ts`, called by both
  `plot.ts` and `pitch-contour-overlay.tsx` (fix already specified, ~15 lines + a test) — until then
  `MIN_SEMITONE_SPAN = 4` lives in two homes and tuning one desyncs the player's two pitch views;
  the untokenized `h-16`/`max-w-xl`/`tracking-widest`/`mx-auto`/`max-w-md` cluster; `${id}-heading`
  duplicated in `section.tsx` and `journey.tsx` (fix: export `headingIdFor(id)`);
  `waveform.test.tsx`'s canvas draw-count flake under parallel load.

## Still true from the 2026-08-26 ruling — do not re-open

`347:6277` IS the design for `/` · the authenticated home stays `dashboard` at `/dashboard` ·
the frame's footer and its "A quieter way to keep going." section win over the reference ·
`346:6275` is the visual quality bar, stays out of the registry, and **must NOT be deleted** ·
imagery is AI-generated so there is no licensing question · **P13** PayOS only · **P14** auth is
email + Google + Apple, GitHub no · **Blender mascot renders are REJECTED**.
