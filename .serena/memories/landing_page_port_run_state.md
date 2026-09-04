# Landing page port (`/`) — CLOSED, merged to master

> **⭐ MERGED 2026-09-04 at `9c0fec2` (`--no-ff`). This branch is DONE.** Branch
> `landing-page-port` is KEPT per repo convention, not deleted. **Nothing is pushed** — local
> `master` runs ~103 commits ahead of `origin/master`, which is normal here (`L-021`).
>
> **This file is no longer a run state. It is the branch's record**, kept because most of it outlives
> the branch: the rulings that still bind, what is still owed to the owner, the method rules this
> work paid for, and the mobile landing page that was deliberately scoped out and is still unbuilt.
> Sessions 1-6 in full are in `mem:landing_page_port_archive` (~96KB; grep it, do not open it whole).
>
> ⚠️ **Navigation, process, and decisions taken on the owner's behalf. It does NOT restate the
> design or the plan.** The spec and `docs/superpowers/plans/2026-08-27-landing-page-port.md` travel
> with the repo; this does not. If this file and either of them disagree, they win.

# ▶▶ READ THIS FIRST IF YOU ARE PICKING UP THE LANDING PAGE AGAIN

**Nothing here is in flight.** For what to work on next, `mem:project_status` § NEXT ACTION governs.
The three live items this branch leaves behind are:

1. **The owner's mobile landing page** — large, unbuilt, and **blocked on two questions** (see its
   section below). It is NOT a mobile version of what shipped; it is a richer page.
2. **What is still owed to the owner** — the section near the end. None of it blocked the merge.
3. **`EMAIL_PROVIDER=none` on `almostgone.vn`** — an OPS task; no commit in this repo can close it.

**Merged-master gate, measured on `9c0fec2`:** `npx tsc --noEmit` 0 · `npm run lint` **0 errors /
81 warnings** · `npm test` **2617 over 283 files, exit 0** · `npm run build` exit 0. The landing-page
e2e was **21/21** on the branch tip against `npx next start -p 3000`.

⚠️ **Two tests flake under parallel load, and they now have names**:
`components/video-player/pitch-contour.test.tsx` and `components/video-player/waveform.test.tsx` —
both `expected 0 to be greater than 0` on canvas call counts after decoding an audio blob. Excluded
three ways (standalone 14/14 ×4 · full re-run 2617/2617 · `waveform` is untouched by this branch yet
shows the identical signature, so the cause is shared and environmental). It fired on several full
runs this session including one before any server was started, so **CPU contention is a hypothesis,
not an established cause** — do not record it as one. **Always
`npm test -- --reporter=dot > <file>` and read the file**: for weeks this was an unnamed rumour, and
naming it took one shell redirect (`L-009`).

## ✅ THE WHOLE-BRANCH REVIEW (L-011) RAN — 2026-09-04, session 8

Report: `.superpowers/sdd/2026-08-27-landing-page-port/review-master-HEAD-report.md`
(⚠️ **gitignored** — it does not travel; it exists only on this machine).
Range `0584b31..9d5545d` (master..branch tip as it stood in session 8; **HEAD has moved since** —
re-derive with `git rev-parse master landing-page-port`). **0 Critical · 3 Important · 3 Minor.**

⚠️ **How it ran matters. It is PARTIAL.** Two dispatched `code-reviewer` subagents both died on a
session rate limit (HTTP 429) before writing anything, so the controller did it inline. The report's
`## Coverage` section is the honest record. **Still unreviewed: `lib/marketing/pitch-demo.ts`'s 429
lines of fixture maths + its 624-line test, and `scripts/mascot/**`.** Do not assume this branch has
had a full pass.

**I1 — the motion gate proved JS RAN, not that the OBSERVER ran.** `themeInitScript` is inline in
`<head>`, outside the bundle, so it armed the `opacity: 0` state even when the bundle 404s, is
blocked by an extension, or aborts hydration — and `RevealScope`, which ships in the bundle, was
then never there to disarm it. The landing page would have stayed blank permanently.
▶ **Reproduced in a browser, both directions**, against a production build on :3001 with
`page.route("**/_next/static/chunks/**", abort)`: failsafe neutralised → **0 of 9** headings opaque
(the defect); failsafe active → **9 of 9**. The negative probe was run *because* the new e2e case
passed on its first run.
▶ Fix: `components/motion/reveal-failsafe.ts` — an INLINE script (it cannot be bundled: it exists to
survive the bundle) releasing the page after `REVEAL_FAILSAFE_MS` unless `RevealScope` sets
`window.__korumeRevealMounted`. It only ever RELEASES — arming late would flash content and then
hide it, which is why `themeInitScript` was left alone. All five hidden rules gained
`:not([data-reveal-failsafe])`, count pinned in `design-tokens.test.ts`.

**I2** — `project_status.md` stated a HEAD its own commit falsified (`HEAD e7696d4`, written by
`9d5545d`). Now names the range + counting command (L-002).

**I3 — "five photographs do not exist in the repo" was FALSE at HEAD.** Every `AssetSlot` call site
passes `src`. The homes, listed rather than totalled (session 8 wrote "SIX" over a list of seven, and
the L-012 review then found an eighth): the `asset-slot.tsx` docblock · both memories · the plan's
owed list · the plan's live Task-4 instruction · the spec's §5.1 · `landing-page-reconciliation.md`'s
G1 · **the plan's Task-4 Step 7 copy-this-code block (`~:608`), found only by the L-012 review** —
the one that would have re-injected the false docblock into shipped source if the task were re-run.
Live claims rewritten; historical analysis kept and dated with a `▶` update.
⚠️ **The delivery DATE session 8 wrote into seven of those homes was wrong** — see the L-012 section.

**Minors:** M1 — the `site-menu.tsx` panel gained `[&[hidden]]:hidden`. Tailwind preflight's rule is
`[hidden]:where(:not([hidden="until-found"])){display:none}`: the `:where()` **contributes** zero
specificity, so the rule weighs one attribute selector — it merely TIES with any single utility class
and loses on source order. M2 — `onBlur` no longer closes the sheet when focus leaves the document.
**M3 NOT fixed, deliberately**:
`asset-slot.tsx`'s `(image pending)` is the branch's only untranslated user-visible string, but the
pending branch is unreached and every fix either invents Vietnamese copy (the owner's) or makes
`AssetSlot` async for all six call sites to serve a dead path. Queued with the owner's copy debt.

**Wave gate, each command run and read:** tsc 0 · lint **0 errors / 81 warnings** (unchanged) ·
`npm test` **2613 over 283 files** (+8 tests, +1 file) · `npm run build` exit 0 ·
`motion never hides content` **7/7** against the production build. Both new `SiteMenu` guards were
mutation-checked: red on mutation, green on restore, `sha256sum -c` confirming the restore.

⚠️ **The wave created one defect and caught it inside itself:** the first `project_status.md` edit
replaced one sentence and left the rest of its paragraph contradicting the new opening. Rewritten as
a block. L-012's shape exactly — which is the argument for the next item.

## ▶ ENVIRONMENT LEFT BY SESSION 9 — read before measuring anything

- **`.next` holds a clean PRODUCTION build of merged master, and NO server is left running** —
  session 9 killed every `node.exe` before its final suite run and :3000 was free afterwards. Check
  the port anyway before starting one: `Get-NetTCPConnection -LocalPort 3000 -State Listen`. `next
  dev` and `next build` share one `.next` and clobber each other, so pick one.
- **Playwright's config hardcodes :3000 with `reuseExistingServer: true`**, so it attaches to
  whatever squats there, healthy or not — including a server serving a build you have since changed.
  Session 8 worked around it with a throwaway config on :3001, deleted after use. **Session 9 did not
  need it**: it ran the suite against `next start -p 3000`, which is the recommended shape — rebuild
  and restart between mutations rather than trusting a warm server.
- ⚠️ **A server holds the build it started with.** Session 9's mutation check only produced its RED
  after the server was restarted on the rebuilt output; the first attempt would have tested the old
  build in memory.

**The merge commit `9c0fec2` can be named here because a LATER commit wrote this line** — the two
fix-wave commits it merges (`b78eac0`, `9212caf`) could not name themselves, which is the L-002
failure this branch paid for four times. Re-derive anything else with
`git log --oneline --first-parent -5 master`.

**Branch `landing-page-port`: MERGED to master, branch KEPT, nothing pushed.** Everything was built:
tasks 1-13, A1/A2/A3, P, V, the independent review and its fixes, **Task A-MOTION (A-M1…A-M5)**, the
L-011 whole-branch review, the L-012 review of its fix wave, and the coverage pass that closed the
rate-limited gap.

**Gate — measured in session 9 on the combined L-011 + L-012 wave, each command run and read. This
is the single home for these figures; `project_status.md` deliberately carries none.**
`npx tsc --noEmit` exit 0 · `npm run lint` **0 errors, 81 warnings** (all pre-existing, none in the
diff; an older note said "11", which was a different counting method — do not repeat it) ·
`npm test` **2615 over 283 files** · `npm run build` exit 0 · `npx playwright test
tests/e2e/landing-page.spec.ts` **21/21**, against `npx next start -p 3000` on a fresh production
build (session 7's figures were 2605/282 and 20/20 — superseded, do not re-cite).
**Session 9's final gate, each command run and read:** `npx tsc --noEmit` exit 0 · `npm run lint`
**0 errors / 81 warnings** (unchanged all branch) · `npm test` **2617 over 283 files**, exit 0 ·
`npm run build` exit 0 · `npx playwright test tests/e2e/landing-page.spec.ts` **21/21** against
`npx next start -p 3000` on a fresh production build · `docs/lessons.test.ts` 2/2.

✅ **THE BRANCH'S LONG-RUNNING FLAKE NOW HAS A NAME.** For weeks it was "a known
`pitch-contour.test.tsx` flake" with no evidence; session 8 hit an uncaptured failure and could say
nothing about it. Session 9 redirected `npm test` to a file *before* reading the summary and the
failures were named immediately: **`components/video-player/pitch-contour.test.tsx`** and
**`components/video-player/waveform.test.tsx`** — both decode an audio blob and assert canvas
draw-call counts, both fail `expected 0 to be greater than 0`, and both only under parallel load.
Excluded three ways (L-009): standalone **14/14 twice**; a full re-run at **2616/2616**; and neither
file imports anything in the session's diff. ▶ **Do not chase it as a regression, and do not let it
absorb a real one** — if a THIRD file joins that pair, that is new information. Always
`npm test -- --reporter=dot > <file>` and read the file.
⚠️ **The full `npx playwright test` is NOT 27/27 in a session without local Supabase.** Five specs
(auth-locale-round-trip · journal · review · route-group-provider-identity ×2) fail with
`ECONNREFUSED 127.0.0.1:54321`; they all register a user. That is the environment, not a defect —
but do not record 27/27 without Supabase up.

## ✅ THE L-012 REVIEW OF THAT FIX WAVE RAN — 2026-09-04, session 9

The owner chose "review the wave first, then commit once", so the L-011 wave and the L-012 fixes
below landed in ONE commit. A dispatched `code-reviewer` (opus) read the whole uncommitted diff —
code and prose — and returned **CHANGES REQUIRED: 0 Critical · 6 Important · 8 Minor**. It did not
die on a rate limit this time; one agent, in flight alone (L-037). Every finding was re-derived by
the controller before being acted on (L-003) and each held.

**The one that matters, and it is I1's own error one level down.** `RevealScope` reported in by
setting `window.__korumeRevealMounted` as its effect's **first statement** — before
`new IntersectionObserver`. So the flag proved *"the effect started"* while the failsafe needs
*"something is watching for the reveal"*, and `IntersectionObserver` throwing — the case the
failsafe's own docblock enumerates — would have disarmed the failsafe and left the page at opacity 0
for good. **The fix wave for a presence-signal-mistaken-for-behaviour bug contained the same
substitution.** Fixed by moving the report-in to after `observer.observe()`; test written first and
seen red (`expected true to be undefined`).
▶ **The reviewer proposed a stronger fix — release unless something was actually revealed — and it
was REJECTED on evidence.** The `[data-reveal="in"]` rules in `globals.css` (`~:417`) carry no
failsafe escape and animate from opacity 0 with `both`, so a backgrounded tab would release the page
and then animate `reveal-rise` over content the reader can already see. The limitation that remains
(an observer constructed but silently inert) is recorded in `REVEAL_MOUNTED_FLAG`'s docblock rather
than papered over.

**The wave's own defects, all of them L-012 shapes:** a delivery DATE invented in seven homes
(`2026-08-28`; only two of six files landed that day, three landed `2026-09-01` — `git log
--diff-filter=A --date=short -- public/marketing/`) · an **eighth** home of the claim I3 existed to
kill, in the plan's copy-this-code block · a "verified in the built CSS as `[hidden]{display:none}`"
parenthetical that the built CSS contradicts, attached to a wrong statement of specificity, in the
version queued for `docs/lessons.md` · a test guarding `data-reveal-failsafe` by a **hardcoded copy**
of the literal, in a file whose sibling exports the constant — renaming the attribute would have left
`npm test` fully green while the failsafe silently stopped releasing anything · an e2e case with no
positive control, so a build that stopped ARMING the hidden state would have passed it vacuously ·
no unit-level guard that the layout injects the script at all.

⚠️ **And the controller reproduced the shape twice while fixing it.** The replacement grep recipe for
the `AssetSlot` census was written, run, and returned **7** instead of 6 — then the parenthetical
added to warn about self-matching *itself contained the pattern* and matched. Both caught by running
the recipe rather than reading it. **Every recipe in this memory and in `asset-slot.tsx` has now been
executed as written and returns the number its prose claims.**

▶ **THE FAILSAFE NOW HAS A REPRODUCIBLE IN-REPO PROOF, IN BOTH DIRECTIONS.** Session 8's negative
probe lived in a throwaway Playwright config on :3001 that was deleted, so nothing travelling with
the branch could reproduce it. The e2e case gained a **positive control**: it asserts the page was
ARMED (all nine headings at opacity 0) before watching it be released, which also subsumes the
500-page guard — a dead server has no headings to count.

⚠️ **The whole measurement runs INSIDE THE PAGE, in one `evaluate` driving a `requestAnimationFrame`
loop, and that is load-bearing.** Session 9's first version used a Playwright `evaluateAll` right
after `goto` and **it raced the 3s failsafe window**: under parallel workers the round-trip lost, and
the control read `hidden: 0` — not because the page was never armed, but because it had already been
released before the assertion arrived. An in-page observer cannot be outrun by scheduling. Two
further traps it hit, both now commented in the spec: sample only once **all nine have parsed**
(`waitUntil: "commit"` starts the loop mid-stream, where only 5 of 9 exist — measured), and give the
loop a budget rather than a single sample.

Mutation-checked properly, on a production build served by `next start`, rebuilding AND restarting
between the two directions:
- failsafe removed from the layout → `korumeRevealMounted` absent from the served HTML →
  **RED: "the failsafe released the page · Received: null"** — armed, then never released. That is
  I1's defect, reproduced by a spec that ships.
- restored (`sha256sum -c` OK) → **GREEN, 21/21**, and 6/6 on `--repeat-each=6`.

**Do not weaken the armed-state assertion, and do not move the measurement back out of the page.**
Without the first, the case goes green on any build that stopped ARMING at all — the "passed on its
first run" signature session 8 recorded. Without the second, it goes green under load for the
opposite reason, which is worse: it looks like a flake.

## ✅ THE COVERAGE GAP IS CLOSED — 2026-09-04, session 9

The nine files the L-011 rate limit left unread have now been reviewed. ⚠️ **A dispatched
`code-reviewer` died on the SAME session rate limit again** (HTTP 429, "session limit · resets
2:30pm") having read nothing — three reviewers lost to it across two sessions now — so the
controller did it inline. **Budget for this: on this project a long session runs out of dispatch
before it runs out of work.**

Scope, all new on the branch (2239 insertions, 0 deletions): `lib/marketing/pitch-demo.ts` (429) +
its test (624), `scripts/mascot/{extract,matte,png,trim}.js`, `png.d.ts`, `poses.json`,
`poses.test.ts`.

**Findings — 0 Critical, 2 Important, 2 Minor, all in prose or robustness; nothing reached output.**
- **`pitch-demo.ts` stated its control-point count in two homes that disagreed with each other AND
  with the array between them** — header "~19", `NATIVE_CONTROL` docblock "Forty-three", arrays hold
  24 and 21. The docblock's argument rests on that number. Fixed, and the count is now machine-checked
  by a new test (mutation-checked: `44` → RED, restore → GREEN).
- **A second coherence figure (`0.720`) contradicted the file's own machine-checked table (`0.715`)**
  — and it was the number the `0.45` threshold's justification leaned on. Now stated once, in the
  table the guard re-derives.
- Minor: `~4 frames apart` was the MINIMUM gap, not the spacing (mean 7.30, min 4, max 12).
- Minor: `png.js` dereferenced `ihdr` without a null check, so a non-PNG threw "Cannot read
  properties of null" instead of naming the input. Minor: `poses.test.ts` mixed two `32` state pins
  into the same test as its permanent set-equality invariant, unlabelled (L-031).

**What was verified CLEAN, and is worth not re-reviewing:**
- **No CLAUDE.md §2 violation.** No downloader/proxy/re-host, no recordings, no secrets. The one
  Japanese sentence is original and its construction is documented.
- **The mascot scripts contain no `exec`/`spawn`/network/`eval`** — filesystem only, on paths from a
  checked-in manifest — and **no app code imports them**: every `scripts/mascot` mention under
  `app/` and `components/` is a comment. Not reachable from the client bundle.
- **`poses.json` reconciles with `public/mascot/poses/` in BOTH directions**: 5 extracted + 27
  supplied = 32 claimed, 32 on disk, zero missing, zero unclaimed; both source sheets exist.
- **`png.d.ts` matches `png.js` exactly**, and `decode` really does validate depth/interlace/
  colortype as the types promise.
- **The detail-layer maths is right**: periods `2π/ω` → native 8.00/13.01/22.52, you 9.00/14.41/25.23,
  amplitude 10.4 against a 66.4 Hz range — all re-derived, all exact.
- **The "illustrative mock data, not measurement" boundary holds in FACT, not just in a comment**:
  the demo contours are consumed only by `components/marketing/pitch-chart.tsx` for rendering, and
  nothing in `lib/pitch` or `lib/speech-scoring` derives a threshold from them.
- ⭐ **`pitch-demo.test.ts`'s header-table test is the best guard on this branch** — it re-parses the
  docblock's measurement table from source, asserts the row count (citing L-004), requires ≥2 numbers
  per row, and re-derives every value at the table's own stated precision. `poses.test.ts` is its
  equal on the asset side. Both were written before any reviewer asked. The defects found above are
  precisely the numbers those guards did *not* cover, which is the useful pattern: **when a file
  machine-checks one of its own claims, audit its other numbers — the guarded one proves the author
  already knew the risk.**

## ⚠️⚠️ A LIVE §2 r4 VIOLATION WAS FOUND AND FIXED — 2026-09-04, session 9

**The reduce-motion kill switch collapsed `animation-duration` but not `animation-delay`.** Every
reveal rule is `animation: … both`, and `animation-fill-mode: both` holds an element at the
keyframe's FROM value — `opacity: 0` — for the whole of its delay. So a reader who asked for no
motion had content **hidden by motion**, for up to `--duration-cinematic * 1.5`. That is
CLAUDE.md §2 rule 4, on the branch whose signature feature is the motion layer.

▶ **How close it came to shipping.** The e2e case that exists to catch exactly this
(`renders every section opaque under reduce-motion`) passed **21/21 twice on the same day**, and
20/20 in session 7, and survived both the L-011 and L-012 reviews. It fires only when the single
assertion lands inside the delay window — measured at roughly **1 run in 12**. It did **not**
reproduce in 25 sequential probe loads; it needs the parallel-worker load. Every instinct said
"known flake" (this suite has one — see the gate section above), and treating it as one would have
merged the defect.

▶ **What actually found it:** sampling **every frame** through load instead of once —
`animationDuration: 1e-06s` (collapsed) sitting beside `animationDelay: 0.09s` (not), element at
opacity 0 across 12 frames spanning ~350ms.
▶ **Fix:** `animation-delay: -1ms !important` + `transition-delay: 0s !important` in BOTH blocks.
Negative, not `0s`: with a 0.001ms duration a frame sampled at the animation's exact start still
reads the FROM value. Test written first and seen RED. Re-probed after: **115 frames, 0 hidden**;
the e2e went 1-in-12 failing → **20/20** on `--repeat-each=5`.
▶ **The guard is now deterministic**, in `lib/design-tokens.test.ts` — a CSS-source assertion that
cannot miss the window. The e2e stays as the behavioural check.

⚠️ **Do not "simplify" the two kill-switch blocks by dropping the delay lines.** They look redundant
next to the duration lines and they are not.

## ✅ EVERYTHING THIS BRANCH OWED IS DONE — the list is kept as the record

1. ~~Whole-branch review (L-011)~~ **RAN** · ~~its fix wave~~ **LANDED** · ~~the L-012 review of that
   wave~~ **RAN, 6 Important + 8 Minor, all applied.** Both reports are in
   `.superpowers/sdd/2026-08-27-landing-page-port/` and ⚠️ **gitignored** — they do not travel, so
   what is written in this memory is all that survives of them.
2. ~~Finish the review coverage the rate limit cut short~~ — **DONE.** All nine never-reviewed files
   read (`lib/marketing/pitch-demo.ts` + its 624-line test, `scripts/mascot/{extract,matte,png,trim}
   .js`, `png.d.ts`, `poses.json`, `poses.test.ts` — 2239 insertions). ▶ See the coverage section
   below. **The branch had a full pass before it merged**; the PARTIAL warning above describes the
   L-011 report only, not the branch.
3. ~~The branch-end `docs/lessons.md` pass~~ — **DONE.** 23 queued items became **2 new ids
   (`L-038`, `L-039`)**, ~9 evidence merges, and 5 relocations to `mem:project_status` § Key gotchas,
   per that file's own rules 2 and 4.
4. ~~Merge~~ — **DONE, `9c0fec2`.**

▶ **THE ONE PIECE OF LANDING-PAGE WORK STILL UNBUILT: the owner's mobile landing page.** Large,
deliberately scoped out of Task 13, and **blocked on two questions** — see its section below. Its
four extra sections (Video · Kanji-inspect · JLPT · Review Mistakes) are the SAME four the 14-section
motion proposal assumed, so those two pieces of work share one open question (does mobile-only
content go on desktop?). Do not start it before the owner answers.

## ✅ TASK A-MOTION — DONE (`da9233e` · `340800d` · `5d31520` · `a22e13e` · `c1c6ab2`)

Spec is in the plan (`029d612`), under `## Task A-MOTION`. It came from a 14-section motion proposal
the owner brought; the **philosophy was adopted, the section map was not** — the proposal describes a
Video section, a Kanji-inspect section, a JLPT section and a Review-Mistakes section that do not
exist here, and omits `Signoff`, which does. ▶ **Owner ruled 2026-09-03: the nine-section page stands
as a landing page; those four are built later, with the mobile page.**

**The architecture, and why it is not GSAP.** `lib/gsap.ts` is still unused, deliberately. The global
reduce-motion block in `globals.css` collapses `animation-duration` honouring the OS query AND the
app toggle, so **CSS motion is gated for free**; a rAF timeline animating inline styles is not
reachable from there at all. ⚠️ **`gsap.matchMedia()` would be a defect here** — it reads only the OS
media query, so it ignores the app toggle (CLAUDE.md §2 r4). Nothing in the shipped scope needs
scrub or pin, so nothing needs GSAP.

**The gate is `:root[data-reduce-motion="false"]:not([data-reveal-failsafe])`**, which
`themeInitScript` sets before paint and only when JS ran. Three cases need no JS branch — motion on
hides then reveals, reduce-motion never hides, JS off never hides.
⚠️ **The whole-branch review found a FOURTH** (2026-09-04, finding I1): that gate proves JS RAN, not
that the OBSERVER ran. `themeInitScript` is inline in `<head>`, outside the bundle, so it arms the
hidden state even when the bundle 404s, is blocked, or aborts hydration — and `RevealScope`, which
ships in the bundle, is then never there to disarm it. The page would stay at opacity 0 for good.
`components/motion/reveal-failsafe.ts` is an INLINE script (it cannot be bundled: it exists to
survive the bundle) that releases the page after `REVEAL_FAILSAFE_MS` unless `RevealScope` reports
in. It only ever RELEASES — arming late would flash content and then hide it. All five hidden rules
carry the escape and the count is pinned in `design-tokens.test.ts`. Scoped under `[data-reveal-scope]` (on the
landing `<main>`) so a marketing page that never mounts `RevealScope` cannot strand its own content
at opacity 0. **Zero new DOM nodes anywhere**: the entrance is attributes on `section.tsx`'s existing
elements, because §6's mascot sits on the node grid's bottom edge to within 1px.

**Geometry proven unchanged:** document **4480px at 1280** — the settled figure exactly — as header
65 + main 3737 + footer 678, measured under reduce-motion so nothing was mid-flight.

▶ **These lessons are now FILED — the `docs/lessons.md` pass ran 2026-09-04 (session 9).**
Do not re-file them. Where they went, and why the destinations differ:
- **A gate that proves a SCRIPT ran does not prove the CODE IT GATES ran**, plus the L-012 finding
  that the FIX repeated it one level down → **`L-039`**, a new id. Both halves are the entry: the
  pair is the lesson, because the second instance is what shows where the wrong model goes next.
- **The wrong-metric family** — §4's fixture rejected four times (slope, then bend, loosened twice,
  when the defect was grain); a pair guard built from per-track statistics; bounds chosen before
  measuring; the hero clamp derived from a reflow ceiling; the scroll-room number that was a fact
  about the window → **`L-038`**, a new id. Seven queued items, one lesson.
- **A verification recipe must be RUN, not read** → merged into **`L-019`**, which already carried
  this exact shape from 2026-08-26. Three iterations of the `AssetSlot` recipe are its new evidence.
- **A test that guards a magic string by restating it** → merged into **`L-006`** (a guard driven by
  the thing it protects is a tautology).
- The rest went to **`L-001`** (never `git checkout --` to undo a mutation), **`L-002`** (the
  `poses.json` diff-count; `pitch-demo.ts`'s two disagreeing control-point counts), **`L-003`**
  (a reviewer's arithmetic, and a reviewer's proposed REMEDY, both need re-deriving), **`L-004`**
  (a test green on its first run; the dead-server sweep; the e2e positive control), **`L-009`**
  (parallel e2e flakes; and an uncaptured failure name), **`L-013`** (a plan step with a correct
  measurement and a wrong cause), **`L-017`** (the gate is unrunnable from cold; a server holds the
  build it started with) and **`L-029`** (`npx playwright test` was never scheduled in the gates).

⚠️ **FIVE of the 23 queued items were NOT filed as lessons, deliberately.** `docs/lessons.md`'s own
§ Scope says its subject is **process**, and technical facts belong in `mem:project_status`
§ Key gotchas. Tailwind's `[hidden]` specificity, the `@keyframes`-`from` rule, transform
composition, `aria-hidden` inheritance and the text-node `Range` technique for finding overflow are
CSS/DOM mechanics, not process — they are now in **`mem:project_status` § Key gotchas**, under
"CSS / DOM mechanics that have already cost this project a defect", each with its incident attached.
Filing them in `lessons.md` would have broken that file's scope rule and its rule 4 at once.

▶ **The shape of the pass, for whoever runs the next one:** 23 queued items → **2 new ids**,
~9 evidence merges, 5 relocations. That is the correct outcome, not a shortfall — rule 2 says merge
rather than append, and rule 4 says "thirty entries that are five variants of five lessons is a
defect". The queue is a list of *incidents*; the file is a list of *lessons*, and the mapping is
many-to-one by design.

▶ **Still owed on this section, none of it blocking:** the `/en#problem` scroll drift was NOT
investigated (it was listed under A-MOTION but is a scroll-anchor question, not a motion-layer one),
and **`site-menu.tsx` still ships with no transition** — the mobile sheet's animation was not part of
what was built.

## ⚠️⚠️ THE OWNER'S MOBILE LANDING PAGE — NOT STARTED, SCOPE ALREADY RULED

Figma file `IwFHZDZdHW7qsSFiNbWrkd`: `429:2` "Landing page 320 px", `433:728` "Landing page 390px",
`434:1453` "Menu". Their generating prompt (18 sections, colours, type sizes, spacing) was given in
the session-6 chat.

⚠️ **The frames are 935px-wide artboards with a ~380/430px centred design column and full-bleed
backgrounds.** Do not read the frame width as the viewport.

⚠️ **It is not a mobile version of the built page — it is a richer page.** ~12 sections against our
9, and at least five have no counterpart: "Understand the pieces without losing the sentence"
(思 / 思ったより / 〜より table) · "Your learning journey becomes context" (timeline) · "Practice
before the real thing" (JLPT N3 set) · "Mistakes become part of the lesson" (01-04 ✓/✕ + Explain) ·
"Your Japanese, all in one place" (あなたの日本語 hub + 9 chips).

▶ **RULED 2026-09-03: build the HEADER + MENU only and close Task 13. The rest is separate work.**

**Two questions must be answered before any of it is built:**
1. **Do the five new sections go on DESKTOP too?** If mobile has them and desktop does not, one page
   carries two different contents — CLAUDE.md §6 calls that a defect, not a trade-off.
2. **What do the menu rows point at?** The owner says a row scrolls to its section. It cannot today:
   the rows are Explore / Shadowing / Kanji / Grammar / Practice / Companion / Pricing / FAQ and no
   section carries those names. The shipped sheet therefore uses the six existing `NAV_ITEMS` at
   their existing routes and drops Pricing/FAQ, which have no URL anywhere.

## ✅ TASK 13 — DONE (`9cebadd`)

The page no longer scrolls sideways at any width in either locale (WCAG 1.4.10, CLAUDE.md §2 r5).
**Three causes, where every earlier note named at most two:**

| where | cause | fix |
|---|---|---|
| en 320/360/390 | `#hero h1` — "understand." is 390.5px at a fixed 64px, in a 288px column | `--text-hero` → `clamp(2rem, 5.7vw + 1rem, 4rem)` |
| en+vi 768 | footer `admin@almostgone.vn` — 153.9px in a 118.4px grid track | `break-words` |
| **en +27.6 / vi +9.6 @320** | **§0's header — in NO earlier note; in vi it is the ONLY offender** | hamburger + sheet |

Also closed here: §3's two Japanese sentence lines got `break-words` (a romaji token measured 285px
in a 68px panel), and the ledger's owed §3 assertion landed as containment **and** keyboard reach.

**Density: settled, do not touch `py-2xl`.** 4480px at 1280 vs frame 347:6277's 4028. Six of eight
sections sit within ±43px of the frame's own bands; the 452px is **+208 signoff** (a section the
frame does not have — owner-ruled), **+358 hero**, **−151 journey**, +35 the rest. Frame bands:
header 60 · 519.7 · 450.0 · 522.9 · 473.3 · 393.3 · 357.7 · 234.1 · 336.5 · footer 681.6.

### ⚠️ The 2026-08-28 "no hamburger" ruling is REVERSED, by the owner

R4 said mobile nav → the app stores instead of a hamburger. Their Figma draws a hamburger. The
arithmetic agreed independently: at 320 the bar has **288px** and its four clusters need
**380.6 (en) / 403.1 (vi)** unwrapped — no combination of smaller type fits, so it was structural,
not styling. Store links keep both footer blocks; nothing was lost.

`components/layout/site-menu.tsx` — read its docblock before changing it. Three things are
load-bearing and each was learned the hard way:
- **Disclosure, not `components/ui/dialog.tsx`.** The design draws no scrim; the Radix modal would
  add a scrim, a scroll lock and a focus trap the design does not have.
- **`absolute top-full`, never `fixed`.** The bar has `backdrop-blur`, and a backdrop filter makes
  its element a containing block for fixed descendants — a `fixed` panel anchors to the 64px bar.
- **It closes on focus-out.** Tabbing past the last row put focus on the hero CTA *underneath* the
  opaque sheet: a focus ring nobody can see, WCAG 2.4.7 failing at exactly one step. jsdom cannot
  see this; only the browser sweep found it.

## ▶ THE METHOD RULES THIS BRANCH PAID FOR — apply before measuring anything

- **Finding page overflow: use a `Range` over TEXT NODES plus an ancestor `overflow-x` walk.**
  Filtering on `getBoundingClientRect().right` returns a wall of irrelevant `LI`s inside `#journey`'s
  scroll container and CANNOT see the offender, because text overflowing its own box does not move
  the box's rect. This single mistake misdirected Task 13 through three sessions.
- **A dead dev server reports ZERO overflow at every width**, because a 500 page has
  `scrollWidth === clientWidth` too. Every browser measurement must first assert the page rendered
  (9 sections). One sweep this session was green against a server returning 500s.
- **A new test that passes on its first run is a defect in the test.** The §3 long-token guard used
  kana and went green instantly — Japanese breaks between characters, so there was no unbreakable
  token in it. Romaji made it red.
- **`aria-hidden` is INHERITED.** Checking it on the element alone reported six false positives.
- **A bound is not a target.** The first hero clamp (`13vw`) was derived only from the reflow ceiling
  and rendered 50.7px at 390 — inside the bound and visibly wrong against the owner's own brief.
  Re-anchored on their two stated sizes (36-40px at 390, 64px at 1280).
- **`git checkout -- <file>` to undo a mutation check DESTROYS uncommitted work in that file.** Copy,
  mutate, restore from the copy, verify with `sha256sum -c`.
- **A guard written over existing code cannot fail first — mutation-check it** and report both
  outputs (CLAUDE.md §7). A collection gathered by a pattern must also be asserted non-empty and of
  the size you expect (L-004).
- **Render at 3x and LOOK, then put the render in front of the owner.** Both of the owner's §4
  corrections came after every metric was green, and both were about the picture.

## ▶ ENVIRONMENT — read before planning any measurement

- **Playwright attaches to a running `next dev` via `reuseExistingServer`. No build is needed.** The
  suite is `fullyParallel` against that one server: transient failures appear in unrelated specs
  under load and pass on re-run — **re-run before believing an e2e failure**, and record a
  non-reproducible one as such (L-009), not as fixed. A test doing many navigations needs
  `test.slow()`; the 18-navigation reflow sweep blew the 30s default under five workers.
- **`.next` goes corrupt** (`Cannot find module './vendor-chunks/@swc.js'`) and the dev server then
  serves 500s. `rm -rf .next` and restart. `next dev` and `next build` share one `.next` and clobber
  each other — that cost one implementer two false diagnoses.
- **`taskkill //PID <pid> //F` worked in session 6**; an older note said the permission classifier
  blocks it. Check the port before starting a second server.
- **This machine is 1280 logical px.** `resize_window` below that reports success while doing
  nothing, and root `zoom` does not move media queries. Use Playwright, or a fixed-width same-origin
  iframe. ⚠️ This ceiling already shipped a WCAG failure once: task A2's implementer measured only at
  1280, where the reflow defect is invisible. **Treat "verified in the browser" as unverified unless
  the widths are named.**

## ▶ STILL OWED TO THE USER — none of it blocks the merge

- **Session 6's own additions:** sign-in is kept in the mobile sheet though the design omits it
  (without it a phone visitor cannot reach an account) — one line removes it; and the two new
  Vietnamese menu strings (`nav.menuOpen` / `menuClose` / `menuAriaLabel`) are mine and are owed to
  the owner's copy pass. Every other vi string is byte-identical.
- **`EMAIL_PROVIDER=none` in almostgone.vn's `.env` before the next deploy.** The only deploy blocker
  left; `sharp` is done (`2d14481`). ▶ **It is an OPS task, not a code task** — this repo has no
  `.env` at all, so no commit here can close it.
- ~~The five photographs~~ — **DELIVERED, no longer owed.** Every `AssetSlot` call site passes `src`;
  the files are in `public/marketing/`. They landed across **2026-08-28 to 2026-09-01**, not on one
  day — session 8 wrote the single date `2026-08-28` into seven homes and it was false in five of
  them. The record is `git log --diff-filter=A --date=short -- public/marketing/`. Re-derive the call
  sites with `grep -rl "<AssetSlot" components/marketing --include="*.tsx" | grep -v asset-slot`
  (returns 6; the trailing filter drops the component's own file and its test, which a recipe
  searching its own directory counts as call sites), never from this line.
- **Discord / Facebook / TikTok URLs do not exist** (reconfirmed 2026-09-02; "after the app is
  stable"). They ship as plain TEXT, not anchors, per spec §2.3. Nothing is broken.
- **§3's card 2 is missing four strings the reference has**: a `5 / 12` counter, a tag chip, a romaji
  line, a small icon caption. A2 built without them rather than inventing content — romaji is *study
  content*, not decoration (CLAUDE.md §2.3). Two catalog keys and one chip would close it.
- **§5's "i+1 Perfect Next Step" badge and topic chips** — in the reference, absent from the frame.
- **`text-heading-lg` widened the app-wide type scale** — the smallest change satisfying §13.1(2)
  without an arbitrary value, but the user may prefer 20px. One line reverses it.
- **`assets/mascot/source/` is 22MB stored, not served.** Deleting it later touches no code path, but
  it is what spec §5.3's inventory table describes.
- **`git stash@{0}` is obsolete** — the first, killed A2 attempt; it contains a test written before
  its implementation and must never be applied. Safe to drop; left because dropping is irreversible.

## ▶ RULINGS THAT STILL BIND — do not re-open any of these

`347:6277` IS the design for `/` · the authenticated home stays `dashboard` at `/dashboard` · the
frame's footer and its "A quieter way to keep going." section win over the reference · `346:6275` is
the visual quality bar, stays out of the registry, and **must NOT be deleted** · imagery is
AI-generated so there is no licensing question · **P13** PayOS only · **P14** auth is email + Google
+ Apple, GitHub no · **Blender mascot renders are REJECTED** · mascot poses are per-placement
hand-picked with real alpha, five placements, `mix-blend-mode: screen` retired · "Save Sentence" →
`/mining` · store affordances → the stores' own front pages.

- **§1's two owed owner decisions are CLOSED** (`44c56f3`). The transport bar's four glyphs DEPICT
  and never function. ⚠️ The timestamp shows ELAPSED ONLY, deliberately — `hero.video.duration` is
  already four rows above it, and "0:24 / 13:00" would put one fact in two places. Do not "complete"
  it.
- **§6's icons are CLOSED** — the owner ruled 2026-09-02 that the shipped glyphs stand, even though
  `346:6275` draws different ones.
- **§6's `xl:items-end` is CORRECT and load-bearing** — the node grid's bottom edge IS the rail, so
  bottom-aligning the companion is what puts its orb on the line. `items-center` looks harmless and
  lifts it off. Pinned in e2e.
- **§4's contours are solid strokes** — WCAG 1.4.1 rests on stroke weight there, an owner-accepted
  trade.
- **The Vietnamese copy is the owner's.** Do NOT create a task, write a report, or edit
  `messages/vi/marketing.json` copy. Parked nits stay in the ledger.
- **§3's card 4 renders `journey.steps.understand.detail` with `journey.steps.mine.detail` tinted
  inside it.** If a copy pass makes the fragment stop occurring in the sentence, a guard goes RED by
  design. Fix the strings or the test, not the fallback.
- **Deferred with rulings, for the whole-branch review, not as section defects:** §6's between-tile
  gap (39.34px vs the reference's ~55) and §6's seven Minors; the physical-axis utility cluster
  (`mx-auto`, `left-1/2`) which is branch-wide with no lint rule; `max-w-md`/`basis-56` hardcoded rem,
  which five prior reviews shipped.

## ▶ WHERE THE FULL RECORD LIVES

- `mem:landing_page_port_archive` — sessions 1-6 in full. Grep it.
- `.superpowers/sdd/2026-08-27-landing-page-port/progress.md` — the ledger. ⚠️ **GITIGNORED**, so it
  does not travel; it exists only on this machine.
- `.superpowers/sdd/2026-08-27-landing-page-port/review-19b05d5-HEAD-report.md` — the independent
  review, 555 lines. **With fixes · 0 Critical · 9 Important · 7 Minor.** Its central claim was
  re-derived and holds (deltaCoherence 0.327 rejected vs 0.720 shipped, threshold 0.45 between).
  **Do not re-raise it as a next action.**
- `docs/lessons.md` — the project's law-adjacent experience, by `L-NNN` id.
