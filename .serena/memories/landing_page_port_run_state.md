# Landing page port (`/`) — run state

> **Live file. Short on purpose.** The full narrative of sessions 1-6 — every measurement, every
> rejected attempt, every piece of evidence behind the rulings below — is in
> `mem:landing_page_port_archive` (~96KB; grep it, do not open it whole). Split 2026-09-03 because
> reading the combined file had become the expensive part of starting a session.
>
> ⚠️ **This memory is navigation, process, and decisions taken on the owner's behalf. It does NOT
> restate the design or the plan.** The spec and `docs/superpowers/plans/2026-08-27-landing-page-port.md`
> travel with the repo; this does not. If this file and either of them disagree, they win.

# ▶▶ RESUME HERE

## ▶ STATE OF THE TREE — run `git status`, do not read it from here

A memory cannot state whether the tree is clean: the commit that lands the wave falsifies any such
sentence in the very act of carrying it (L-012's sharpest shape, and session 8 shipped exactly that
sentence). **Run `git status` and `git log --oneline -6`.** Sessions 8 and 9 left nothing merged and
nothing pushed; if that has changed, git says so and this line does not.

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

- **`.next` holds a clean PRODUCTION build of the restored tree**, and session 9 left
  `npx next start -p 3000` RUNNING against it. Session 8's stale dev server is gone (session 9 found
  :3000 free). Check the port before starting anything: `Get-NetTCPConnection -LocalPort 3000 -State
  Listen`. If you want dev, kill it first — `next dev` and `next build` share one `.next` and
  clobber each other.
- **Playwright's config hardcodes :3000 with `reuseExistingServer: true`**, so it attaches to
  whatever squats there, healthy or not — including a server serving a build you have since changed.
  Session 8 worked around it with a throwaway config on :3001, deleted after use. **Session 9 did not
  need it**: it ran the suite against `next start -p 3000`, which is the recommended shape — rebuild
  and restart between mutations rather than trusting a warm server.
- ⚠️ **A server holds the build it started with.** Session 9's mutation check only produced its RED
  after the server was restarted on the rebuilt output; the first attempt would have tested the old
  build in memory.

**Run `git log --oneline -8`.** The last hash this file can honestly state is **`9d5545d`**
(2026-09-04, the tip session 8 inherited); session 8 committed nothing, and session 9's own commit
cannot be named here. A file cannot name the commit that contains it — writing one means predicting
it, which is the L-002 failure this branch has paid for four times.

**Branch `landing-page-port`. Nothing merged, nothing pushed.** Everything is built: tasks 1-13,
A1/A2/A3, P, V, the independent review and its fixes, and **Task A-MOTION (A-M1…A-M5)**.

**Gate — measured in session 9 on the combined L-011 + L-012 wave, each command run and read. This
is the single home for these figures; `project_status.md` deliberately carries none.**
`npx tsc --noEmit` exit 0 · `npm run lint` **0 errors, 81 warnings** (all pre-existing, none in the
diff; an older note said "11", which was a different counting method — do not repeat it) ·
`npm test` **2615 over 283 files** · `npm run build` exit 0 · `npx playwright test
tests/e2e/landing-page.spec.ts` **21/21**, against `npx next start -p 3000` on a fresh production
build (session 7's figures were 2605/282 and 20/20 — superseded, do not re-cite).
⚠️ **One unit test failed on the first of three full runs and was never captured.** Two further full
runs (2615/2615, exit 0) and six runs of the four touched files were clean, so it is recorded as
NON-REPRODUCIBLE, not as fixed (L-009) — and the name is unknown because the output was not written
to a file. **Redirect `npm test` to a file before reading its summary**; a failure you cannot name is
a failure you cannot diagnose.
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
the branch could reproduce it. The e2e case gained a **positive control** — one `evaluateAll`
immediately after `goto`, asserting `{total: 9, hidden: 9}` — which proves the page was ARMED before
the poll watches it be released, and which subsumes the 500-page guard (a dead server has no
headings to count). Mutation-checked properly, on a production build served by `next start`:
- failsafe removed from the layout, rebuilt, `korumeRevealMounted` absent from the served HTML →
  **RED: `Expected: 0, Received: 9`** — the positive control passed, then nothing ever released the
  page. That is I1's defect, reproduced by a spec that ships.
- restored (`sha256sum -c` OK), rebuilt, script back in the HTML → **GREEN, 21/21.**

**Do not weaken that pre-assertion.** Without it the case goes green on any build that stopped
ARMING the hidden state at all, which is the "passed on its first run" signature session 8 recorded
and then had to chase out-of-repo.

## ▶▶ WHAT REMAINS, IN ORDER

1. ~~Whole-branch review (L-011)~~ **RAN** · ~~its fix wave~~ **LANDED** · ~~the L-012 review of that
   wave~~ **RAN, 6 Important + 8 Minor, all applied** (section above). Both reports are in
   `.superpowers/sdd/2026-08-27-landing-page-port/` and ⚠️ **gitignored** — they do not travel.
2. **Finish the review coverage the rate limit cut short** — `lib/marketing/pitch-demo.ts`'s fixture
   maths and its 624-line test, plus `scripts/mascot/**`. Neither has had a whole-branch pass. This
   is the oldest unpaid debt on the branch; it is not closed by either review above.
3. **The branch-end `docs/lessons.md` pass — now 23 queued entries** (16 listed at the end of the
   archive's session-5 and session-6 sections, plus two from A-MOTION, two its review added, and
   three from the L-012 review — all seven below).
4. **The owner's mobile landing page** — new, large, and deliberately out of scope. See below.
   ▶ Its four extra sections (Video · Kanji-inspect · JLPT · Review Mistakes) are the SAME four the
   motion proposal assumed, so the two pieces of work share one open question. See A-MOTION below.

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

▶ **Lessons queued for the `docs/lessons.md` pass — two from A-MOTION, two from its review, three
from the L-012 review of the fix wave:**
- **A gate that proves a SCRIPT ran does not prove the CODE IT GATES ran.** The reveal gate keyed on
  an attribute set by an inline `<head>` script, then relied on a bundled observer to clear it. Two
  independent failure domains, one treated as proof of the other. The e2e covered "JS off" and "JS
  works" and could not see the state between them.
  ▶ **And the FIX made the same substitution one level down** (L-012 review): the flag meant to prove
  the observer arrived was set as the effect's first statement, before the observer was constructed,
  so `IntersectionObserver` throwing disarmed the failsafe. **When a bug is "signal X was taken as
  proof of behaviour Y", the fix's own signal is the first thing to re-check** — it is written by
  whoever just had the wrong model, and it is where the wrong model goes next.
- **Tailwind preflight's `[hidden]` rule is `[hidden]:where(:not([hidden="until-found"]))`: the
  `:where()` CONTRIBUTES zero specificity, so the rule weighs one attribute selector.** It merely
  ties with any single utility class and loses on source order, so `hidden` on an element that later
  gains `flex`/`block` silently stops hiding. ⚠️ Do not write "the rule has zero specificity" — that
  is a different and false claim (it would then lose to every class), and it is what session 8 wrote,
  next to a "verified in the built CSS" parenthetical quoting CSS the build does not contain.
- **A verification recipe must be RUN, not read** — and a recipe written inside the file it searches
  matches its own text. `grep -rn "<AssetSlot" components/ | wc -l`, offered as the thing to trust
  instead of the prose, returned 12 against a claim of 6: its own docblock line plus five test
  renders. The replacement then returned 7, and the parenthetical warning about self-matching
  contained the pattern and matched too. **Three iterations, each caught only by execution.** Cheap
  to check, and it is the one line in a document that readers are told to believe over the rest.
- **A test that guards a magic string by restating it guards nothing.** `design-tokens.test.ts`
  filtered CSS rules for a hardcoded `':not([data-reveal-failsafe])'` while its sibling module
  exported `REVEAL_FAILSAFE_ATTR`. Renaming the attribute would have left every unit test green — the
  CSS unchanged, the test still matching the old literal — while the failsafe silently stopped
  releasing anything. **Build the literal from the exported constant, or the guard tests the copy.**
- **A keyframe with only a `to` takes its `from` from the element's live computed value.** §4's
  contour draw shipped broken for one commit because `stroke-dashoffset: 1` lived only on the
  `pending` rule, which stops matching the instant the state flips to `in` — so the animation ran
  0 → 0 and the paths just appeared. Unit tests were green; only a browser probe of
  `getComputedStyle` mid-animation saw it. Now pinned in `design-tokens.test.ts`.
- **A child transform composes with its ancestor's, it does not replace it.** `reveal-fade` exists
  beside `reveal-rise` for exactly this: stepped collections nest inside a block that already rises,
  and using `reveal-rise` on both gives ~48px of travel and two easing curves fighting.

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
