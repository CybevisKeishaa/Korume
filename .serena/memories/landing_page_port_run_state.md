# Landing page port (`/`) — run state

> **Status: SPEC + PLAN WRITTEN AND COMMITTED. No implementation code exists yet.**
> `mem:project_status` § NEXT ACTION points here and carries the gist only.
>
> ⚠️ **This memory is navigation and process. It deliberately does NOT restate the design or the
> plan.** The spec and the plan travel with the repo; this does not. If this file and either of them
> disagree, they win and this file is the bug.

# ▶▶ RESUME HERE

**Branch `landing-page-port`, cut from master, two commits, nothing merged:**

| Commit | What |
|---|---|
| `81a20c9` | `docs/superpowers/specs/2026-08-27-landing-page-port-design.md` — the design |
| `bfdb070` | `docs/superpowers/plans/2026-08-27-landing-page-port.md` — 13 tasks, 93 steps — plus two spec amendments |

**The next action is Task 1 of the plan** (the `marketing.json` catalog, `en` + `vi`). Read the plan;
it is step-by-step and assumes no context.

**One decision is owed before execution starts: HOW to execute.** The user was offered
subagent-driven (a fresh subagent per task, review between tasks) vs inline, and chose neither before
the session ended. Subagent-driven is the recommendation and matches
`mem:` feedback-one-agent-in-flight — **never dispatch task N+1 until task N's implementer AND
reviewer have both returned and the review has been read**.

## Which file answers which question

| Question | Authority |
|---|---|
| What to build, section by section; the four gaps G1–G4 | `docs/product/landing-page-reconciliation.md` |
| How this port is designed, and every ruling it inherits | the spec, `2026-08-27-landing-page-port-design.md` |
| The executable steps, the test code, the commit boundaries | the plan, `2026-08-27-landing-page-port.md` |
| Which node id is what | `docs/product/figma-frame-map.md` |
| Overall project state, what comes after | `mem:project_status` |

## What this session settled — five rulings, none to be re-litigated

All from the user, 2026-08-27. All are written into the spec; this is the index, not the text.

1. **Blender renders are REJECTED.** `public/mascot/renders/*` (10 files) are broken and ugly; do not
   use them here or anywhere without a fresh ruling. They were NOT deleted — that is its own
   decision, still open.
2. **Nav destinations** — keep all six frame labels, map them onto routes that already exist, add no
   routes. Explore→`/shadowing/explore`, Practice→`/review`, the other four to their own route.
3. **Footer destinations** — the frame's footer names ten, only `Home` and `Roadmap` exist. Every
   label stays; a label with a real destination is a link, one without renders as **text, not an
   `<a>`**. No `#`, no placeholder route. Extended unasked to Discord/Facebook/TikTok and both app
   stores.
4. **§2's six chip sub-labels** — the frame repeats `"Learn in context"` six times, the same defect as
   §6 and one `landing-page-reconciliation.md` never named. Three read off the reference; the three
   Japanese ones were **confirmed by the user rather than guessed**.
5. **Vietnamese copy** — drafted by the agent in the existing voice, reviewed by the user in one pass
   at the end. `lib/i18n/catalog.test.ts` enforces identical key sets, so an English-only intermediate
   state is not representable.

## Two things that were MEASURED, not assumed — re-runnable

Both replaced assumptions that would otherwise have shipped as facts.

1. **The mascot composites with no matting.** `public/mascot/Korume.png` (1402×1122) is the character
   cut out on **pure black** — all four corners `(0,0,0)`. The page background is `--void-950` =
   `#0b0d11`. Because `screen(0, bg) = bg`, `mix-blend-mode: screen` maps its black exactly onto the
   background and keeps the tails' glow falloff. A simulated composite showed no halo, no rectangle,
   no edge artefact.
2. **One mascot pose covers all four placements.** Cropping §1, §4, §6 and §8's mascots out of
   `346:6275` and viewing them side by side shows one character in one pose — seated on the glowing
   orb, tails fanning right. Four separate poses are not required.

Neither is in `public/mascot/renders/`. The other five non-render files are character sheets on
opaque grey/cream backgrounds that would need real matting, and two of them carry the **pre-rebrand
wordmark "NIHONGO CINEMA"** in their chrome — so any future crop must exclude sheet chrome as well as
background. Not needed for the initial port.

## Process notes — worth not re-learning

- **`get_metadata` truncates text node names at 50 characters.** Proven: §6's heading came back as
  `"Everything connects. Everything builds on each oth"`. Metadata is for structure and node ids
  only; **all copy comes from `get_design_context`**. The plan's Task 1 Step 1 lists the twelve
  strings this affects and the node each comes from.
- **The reference `346:6275` is 864×1821 and that IS its native size** — `get_screenshot` at
  `maxDimension=6000` returns `original_width=864`. There is no more detail to be had. Reading its
  small type works by downloading the PNG and cropping + upscaling regions locally (PIL is available;
  **numpy is not**).
- **That crop-and-upscale trick is what unblocked §6.** All eight captions read cleanly, so a question
  that looked like it needed the user did not. §2's three Japanese sub-labels sat right at the
  legibility edge and did need one — the line between the two cases is whether you would be shipping
  a guess.
- **Self-review of the plan caught a real hole**: the §1 catalog was missing twelve keys the frame
  carries (four transcript tabs, two transcript lines, the sentence rail's jp/romaji/en, Key words,
  the Companion card) plus two in §3. Without that pass Task 4 would have built half a hero. Run the
  spec-coverage check against the *extracted copy*, not against the spec's prose.
- **The plan deliberately leaves the tree broken between Task 1 and Task 3.** Task 1 Step 5 runs
  `typecheck` and EXPECTS failure, because the catalog drops `header.*`/`footer.cta` that the current
  chrome still reads. It is recorded as expected and must not be "fixed" by re-adding the keys.

## Open items — none block the merge

- **The five photographs.** Still the reason `AssetSlot` exists. Licensing is closed (AI-generated);
  what is owed is the files. Do not slice them out of `346:6275`.
- **§5's "i+1 Perfect Next Step" badge and topic chips** (Daily Life, Commuting) — present in the
  reference, **absent from the frame's text layers**. Content the frame does not carry, so it is a
  question for the user, not a gap to fill.
- **Discord / Facebook / TikTok URLs**, and whether either app-store block should ever become a link.
- **Whether to delete `public/mascot/renders/` and `assets/blender/references/`** now that Blender is
  rejected.

## Still true from the 2026-08-26 ruling — do not re-open

`347:6277` IS the design for `/` · the authenticated home stays `dashboard` at `/dashboard` (a
`/home` rename was offered and declined; ~89 files depend on it) · the frame's footer and its "A
quieter way to keep going." section win over the reference · `346:6275` is the visual quality bar,
stays out of the registry, and **must NOT be deleted** (it renders blank if hidden — check
`get_metadata` before concluding it is empty, `L-019`) · imagery is AI-generated so there is no
licensing question and `CLAUDE.md` §2.3 does not apply to it · **P13** PayOS only · **P14** auth is
email + Google + Apple, GitHub no.
