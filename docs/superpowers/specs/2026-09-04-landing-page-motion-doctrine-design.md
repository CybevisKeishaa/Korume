# Landing-page motion doctrine — design

> Status: DESIGN, approved in chat 2026-09-04. Not yet planned, not yet built.
> Supersedes nothing. Extends Task A-MOTION (merged `9c0fec2`), which built the entrance
> reveal system this design keeps and builds on.

---

## 1. The problem

The landing page ships one motion mechanism applied to nine sections. Every section enters the
same way: eyebrow, then heading, then body, each a `reveal-rise` (24px + fade) offset by
`--duration-stagger`. Five sections add a stepped collection on top of it (`reveal-fade` on chips,
steps, cards, contours, chain nodes), but the *verb* is identical everywhere — things fade in and
rise.

Two sections already escape this and prove the point: §4 draws two pitch contours in sequence
before its sub-scores settle, and §6 cascades eight chain cells with their connectors and rail
dots. Those two read as authored. The other seven read as a template.

The owner's judgement, 2026-09-04: *"motion kiểu vậy thì nó chung chung nhàm quá"* — and the ask
is variety, one distinct mechanism per section.

**This design gives each section its own physical metaphor and its own verb, while binding all
nine to a single through-line so that variety does not become noise.**

---

## 2. The doctrine

Four rules. Everything below follows from them, and a change that breaks one of them is a defect,
not a trade-off.

> **Thread moves the story.**
> **Mascot embodies the relationship.**
> **Section mechanism explains the idea.**
> **Static mascot preserves presence.**

The fourth is the least obvious and the most load-bearing. Presence is not motion: a companion
that animates every time it appears stops being a companion and becomes an animation object. Two
of the five mascots on this page are deliberately, permanently still.

### 2.1 What this rules out

- **A mascot that travels between sections.** Considered and rejected 2026-09-04. It forces a
  placement problem in every section that already has a mascot, and by the fourth appearance the
  reading is *"the mascot is flying over here again"* — which demotes the Companion to a prop.
- **One mechanism per section chosen for novelty.** Each mechanism must be the section's own
  metaphor. If a mechanism could be swapped between two sections without either looking wrong,
  at least one of them is decoration.
- **Motion in every section at full intensity.** §4 and the footer are deliberate quiet zones.
  Playbook §9's rhythm rule: a page with no rests does not breathe.
- **A thread segment in every section.** See §3.3. Requiring one everywhere is how a design
  grammar degrades into a mandatory visual prop.

---

## 3. The Korume Learning Thread

**The Thread is design grammar, not an animation and not an object.** It is realised as many local
segments that share one vocabulary. One through-line, four morphologies. The reader is never told
these are the same line; continuity is felt, not announced. It may appear, transform, disappear and
return — and the gap is what makes the return legible.

| State | Shape | Where |
|---|---|---|
| **LINE** | `────────` | transitions between sections |
| **CONNECTION** | `●────────●` | §2, where the system is assembled |
| **PATH** | `● ╲ ● ╲ ●` | §6, the learning path |
| **KNOWLEDGE CURVE** | `───╮ ╰──╮ ╰──` | §4, where the line becomes pitch |

The thread's journey ends at **§9 Signoff**, not at §8 CTA. The CTA is an invitation sitting on
the path; the Signoff is the resolution. This was an explicit owner ruling, 2026-09-04, and it
resolves a real gap: the page has nine sections and the first draft of this narrative had eight.

### 3.1 The Thread is not one element

⚠️ **There is no single DOM node spanning the page.** Each section owns its own segment, sized and
positioned inside that section:

```
§1 ── ThreadSegment          §5 ── ThreadSegment
§2 ── ThreadSegment          §6 ── frozen, no new choreography
§3 ── ThreadSegment          §7 ── ThreadSegment (low intensity)
§4 ── frozen, no segment     §8 ── ThreadSegment
                             §9 ── ThreadSegment → resolution
```

A single spanning element would have to be positioned across section boundaries that already carry
settled geometry (§6's rail alignment is asserted to 1px), would fight every responsive reflow, and
would put one element's failure in charge of the whole page's through-line. Per-section segments
degrade one section at a time.

### 3.2 Continuity is motion grammar, not DOM topology

⚠️ **Segments do not need to meet at section boundaries, and must not be built as if they do.**
Two adjacent segments may have completely different geometry:

```
        §2 segment
                 ╲
                  ●
        ─ ─ ─ section boundary ─ ─ ─
                  ●
                 ╱
        §3 segment
```

What binds them is a shared **motion grammar**:

- the same visual tokens (below),
- the same stroke language and cap,
- the same accent,
- the same easing family,
- and the exit direction of one segment agreeing with the entrance direction of the next.

Continuity is a property of the vocabulary, not of the layout tree. This is what lets a segment be
absent for a whole section without the through-line breaking.

**The token contract** — every segment consumes these, and none may define its own:

```css
--thread-width
--thread-color
--thread-opacity
--thread-cap
--thread-ease
--thread-duration
--thread-dash
```

**The continuity obligation is therefore a test, not a wish.** A CSS-source assertion pins the
contract: if §3 uses its own width, or §7 its own easing, the suite goes red. "Make sure the thread
looks continuous" is not a check; this is.

### 3.3 A section may have no segment

**If a section's own mechanism already carries the reading, it does not get a thread segment.** §4
is the standing example: its pitch curves *are* the thread in that section's morphology, and adding
a separate segment beside them would be an ornament competing with the section's actual subject.

This rule exists to protect the doctrine from itself. The moment every section must display a
thread, the Thread stops being grammar and becomes a prop that each section is obliged to hold —
which is the same failure mode as a mascot that must fly into every section.

---

## 4. The mascot map — five assets, three animated

All five existing poses stay. None is removed. This was ruled 2026-09-04 after the code check
showed the pose library is authored per-placement, not incidental: `scripts/mascot/poses.json`
carries written slots for §1, §4, §6, §8 (two) and §10 footer.

| Where | Asset | Rendered by | Role | Motion |
|---|---|---|---|---|
| §1 Hero | `greeting.png` | `hero-video-card.tsx` | Introduce the character | ✅ animated |
| §4 Pitch | `noting.png` | `pitch-showcase.tsx` | A sensei observing | ❌ **static** |
| §6 Chain | `reading-on-the-orb.png` | `capability-chain.tsx` | Guide at the path's endpoint | ✅ animated |
| §8 CTA | `hugging-an-orb.png` | `cta.tsx` | Companion at the invitation | ✅ animated |
| Footer | `resting.png` | `site-footer.tsx` | End of day | ❌ **static** |

The three animated appearances carry three different semantic roles — *"Hello"*, *"I'm with you
through the system"*, *"Let's begin"* — not three instances of the same entrance. §8's mascot is a
new scene, never a character arriving from §6.

**§4's and the footer's stillness is the design, not an omission.** §4's mascot is a visual anchor
inside the page's most technical motion; the footer's is the emotional anchor at the end of
everything. `resting.png` is the frame's `KorumeSleepingPeacefullyOnABook`, placed under *"The day
can end softly."* — a narrative decision that predates this spec.

---

## 5. Per-section mechanism

Nine verbs. `Enter → Understand → Connect → Experience → Discover → Build → Trust → Begin → Rest`.

| § | Section | Metaphor | Verb | Thread | Status |
|---|---|---|---|---|---|
| 1 | Hero | Cinematic camera push | **Enter** | segment | NEW |
| 2 | Problem | Node assembly / orbit | **Understand** | segment | NEW |
| 3 | Journey | Learning conveyor | **Connect** | segment | NEW |
| 4 | PitchShowcase | Pitch-line draw | **Experience** | none | 🔒 **FROZEN** |
| 5 | Recommendation | Calibration scanner | **Discover** | segment | NEW |
| 6 | CapabilityChain | Learning path | **Build** | frozen | 🔒 **FROZEN** |
| 7 | Trust | Quiet lock | **Trust** | segment, low | NEW |
| 8 | Cta | Invitation | **Begin** | segment | NEW |
| 9 | Signoff | Thread resolves | **Rest** | resolution | NEW |

### §1 Hero — camera push

The page's most expensive motion. The section is a two-column grid: copy plus two CTAs on the
left, `HeroVideoCard` on the right (which owns the `hero-still.png` frame, the transport bar, the
sentence rail and `greeting.png`).

**The heading reveals as one block, never line by line.** Ruled 2026-09-04. A per-line reveal needs
either a JS measure pass or hard-coded `<span>`s, and the heading is a single catalog string that
wraps to a different number of lines in English and Vietnamese at every width. The architecture must
not bend for one effect. The block gets:

```
opacity: 0 → 1
translateY: 20–28px → 0
clip / mask: hidden → visible
```

Typography never needs to know whether it wrapped to three lines or five, and it stays
multilingual-safe with no measurement pass and no fragile DOM.

The cinematic sequencing lives **inside the video card** instead, which is where it belongs:

```
Hero enters → heading block → body → CTA → video image → subtitle/metadata → Companion
```

On scroll: the video card scales `1.00` toward `0.94` and lifts as the section leaves, and the
thread segment draws downward.

⚠️ **The exact scroll distance is deliberately not specified.** Not "over 600px", not "over 800px" —
`TBD by render review`, measured at 1280 and at 390. Freezing that metric on paper before seeing it
is how the first hero clamp shipped at 50.7px: inside its bound and visibly wrong.

This is the one section whose motion is scroll-*progress* driven rather than entrance-triggered.

### §2 Problem — node assembly

The six chips are not six cards. They are six parts of one system: Vocabulary, Grammar, Kanji,
Pronunciation, Listening, SRS. They arrive scattered and assemble; the constellation's lines then
draw between them (`stroke-dashoffset`). The centre sentence lands last.

⚠️ **§2's acceptance criterion is visual and cannot be asserted in pixels:**

> At rest, the six capabilities must read as one connected learning system rather than six
> independent cards.

A sequential six-chip stagger will pass every unit test and every timing assertion while failing
this. **A green suite is not evidence for this section** — it needs a render review with the owner's
eye, and it may need to be rebuilt after the first attempt. Budget for that rather than treating the
first green as done.

The reading this earns: *"Korume doesn't teach these separately."*

### §3 Journey — learning conveyor

Five steps, handed off rather than revealed together. The semantic choreography is fixed:

```
Video → Sentence → Vocabulary → Grammar → SRS
```

Each step wakes as the thread reaches it. Horizontal in feeling, but **not** a horizontal-scroll
pin (see §8 of this spec).

⚠️ **The timing is deliberately not specified.** No `150ms / 250ms / 350ms` in this document,
because the right values depend on the real distance between cards, the scroll velocity and the
viewport. `TBD by render review`, and the review decides: how much the cards overlap, whether the
hand-off is too fast, how long the outgoing card holds, whether the next enters by translate or
opacity, and whether the thread leads the eye clearly enough.

### §4 PitchShowcase — 🔒 FROZEN

**DO NOT MODIFY.** This section ships correct and is not a task in this work.

Specifically forbidden: changing the mascot, changing the geometry, changing the score, adding a
count-up, changing the layout, or "cleaning up" the existing animation. The only permitted contact
is hooking it into the motion system **if that changes no existing behaviour**.

It gets **no thread segment** — its pitch curves are the thread in that morphology (§3.3).

Two constraints already enforced in `app/globals.css` and restated here so a future reader does not
undo them:

- **`87` does not count up.** Ruled 2026-09-04, upheld. Animating the digits puts a second,
  transient value on screen for a number the copy states once — a false reading for anyone glancing
  mid-animation, on a page about pronunciation scoring.
- The dash declarations must be repeated on the `"in"` rule, not only on `"pending"` — a
  `@keyframes` block with only a `to` takes its `from` from the live computed value.

### §5 Recommendation — calibration scanner

A different mechanism from §4 on purpose. Known vocabulary scans, then the new lesson resolves,
then the donut arc sweeps `0 → 96` via `stroke-dashoffset`. The `NEW` word reveals last.

**The donut sweep is geometry, not digits, so §4's ruling does not cover it.** The component was
authored for exactly this: `recommendation-donut.tsx`'s docblock states the arc was built as a
`stroke-dasharray` sweep *"because that is the one shape a later `stroke-dashoffset` tween can
animate without re-authoring the geometry"*, and it already carries `data-familiar-donut` /
`data-familiar-arc` hooks that no CSS rule consumes today. **This section is wiring, not
invention.**

⚠️ That docblock also says *"The whole-page motion pass is a later task"* — false since Task
A-MOTION. It must be corrected in the same change, or the file keeps arguing its reduce-motion
obligation from a premise that stopped being true.

The metaphor is **discovery/calibration**, not growth: *"Korume is finding the right next thing
for me."*

### §6 CapabilityChain — 🔒 FROZEN

**DO NOT MODIFY.** Eight cells cascade in DOM order, connectors and rail dots one beat behind, the
mascot standing at the endpoint. The mascot endpoint is already right; the chain is already right.

Not an animation playground. `xl:items-end` is load-bearing and pinned in e2e — the node grid's
bottom edge is the rail.

### §7 Trust — quiet lock

Intensity drops to roughly 30–40% of §1. This section is about privacy (*"Your recordings stay
private"*, *"Your data is yours"*, *"AI with clear boundaries"*), and it is the page's
**deceleration zone** — the rest before the CTA.

The thread segment is low-intensity: progress `0 → 1` on `stroke-dashoffset`, opacity slightly
reduced, arriving at a lock, and then stopping. The three cards follow slowly, in sequence. No
playful motion.

### §8 Cta — invitation, and a thread **continuation**

⚠️ **The thread does not complete here.** §8 is a continuation, not the destination — a distinction
that changes what the segment does at its end (it passes through, it does not land).

```
───────────────●
               CTA
```

A new scene, not a character arrival. Background settles `1.03 → 1.00`; the orb floats; the mascot
breathes almost imperceptibly; the CTA reveals last. The copy says *"Start learning"* — an
invitation.

### §9 Signoff — resolution

The one section whose mechanism is not an entrance but a **resolution**. No large new device:

```
Thread → slows → curves → settles → opacity down
```

Then *"A gentler way to keep going."* and *"The day can end here."* The footer below is fully
still, with `resting.png` asleep on its book. This is where the page breathes out.

---

## 6. Architecture

Approach C, chosen 2026-09-04: **CSS for every section mechanism, exactly one JS engine.**

```
                    KORUME MOTION SYSTEM

                       SCROLL PROGRESS
                            │
             ┌──────────────┴──────────────┐
             │                             │
       SECTION MOTION                THREAD SEGMENTS
             │                             │
    ┌────────┼────────┐               shared tokens
    │        │        │                    │
  Hero      §2       §3            width · accent
 camera   system  hand-off         easing · stroke
    │        │        │
   §5       §7       §8
 scanner   lock     CTA
    │
   §9
 resolve

                  MASCOT SYSTEM
                       │
        ┌──────────────┼──────────────┐
      Hero            §6             §8
    animated       animated       animated

        §4                        Footer
      static                      static
```

### 6.1 Why not GSAP, and why not scroll-driven CSS

**No GSAP.** `lib/gsap.ts` stays unused. The reduce-motion kill switch in `app/globals.css`
collapses `animation-duration`, `animation-delay` and `transition-delay` for CSS animations,
honouring the OS query *and* the app toggle. A rAF timeline mutating inline styles is not
reachable from there at all, and `gsap.matchMedia()` reads only the OS query — using it would
reintroduce the CLAUDE.md §2 r4 defect found live on this page on 2026-09-04.

**No `animation-timeline` for anything load-bearing.** Measured 2026-09-04: Chrome/Edge 115+ and
Safari 26 support scroll-driven CSS animations, but **Firefox still gates it behind
`layout.css.scroll-driven-animations.enabled` in stable as of Firefox 152 (June 2026)**; global
support ≈84%. The repo declares no browserslist. A through-line that vanishes for ~16% of readers
is not a through-line. It may be used later as `@supports` progressive enhancement for purely
decorative touches; it is not in this design.

### 6.2 The motion gate — `lib/motion/motion-enabled.ts`

One module, the single source of truth for "may JS animate right now".

- Reads **both** `matchMedia("(prefers-reduced-motion: reduce)")` **and** the root element's
  `data-reduce-motion` attribute (via `MutationObserver`, because the app toggle mutates it after
  paint).
- Exposes a subscribe/unsubscribe API for imperative consumers and a `useMotionEnabled()` hook
  over the same store for React ones.
- When it reports false, every consumer writes its **final** state once and stops. Never an
  intermediate state, never a running loop.

This is the only new thing that must be proven correct, and it is provable by unit test.

### 6.3 The scroll-progress provider

One engine. Not a mascot mover — the mascot no longer travels.

- Writes a normalized `[0,1]` `--section-progress` custom property on each section as it passes
  through the viewport. CSS reads it; no component computes geometry in JS.
- rAF-throttled, and **only sections currently intersecting compute** — an IntersectionObserver
  activates and deactivates them.
- Consults the motion gate before doing anything. Motion off → write the final value once, stop.
- `<768px`: no pin, no scroll hijack, simplified progress. Matches Tailwind's `md:` breakpoint at
  exactly 768 so the gate cannot leave a dead zone on iPad portrait.
- Full teardown of every listener, timer, rAF and observer (React StrictMode double-mounts in dev).

This follows playbook §1 principle 3 — scroll normalized to `[0,1]`, everything hung off the
percentage — rather than each section inventing its own scroll mechanism.

### 6.4 What stays exactly as it is

`RevealScope` (one page-level `IntersectionObserver`, `rootMargin: "0px 0px -10% 0px"`,
unobserving each target after it flips) and `reveal-failsafe.ts` (inline, out-of-bundle, releases
the page after `REVEAL_FAILSAFE_MS = 3000` unless the observer reports in) are the entrance
substrate for all nine sections. Every new hidden rule **must** carry
`:not([data-reveal-failsafe])`, and the count of such rules is pinned in `design-tokens.test.ts`.

Existing tokens are the vocabulary; no new duration or easing literals:
`--duration-fast` 150ms · `--duration-base` 300ms · `--duration-slow` 600ms ·
`--duration-cinematic` 1200ms · `--duration-stagger` 90ms · `--ease-standard` `ease-out` ·
`--ease-out-expo` `cubic-bezier(0.16, 1, 0.3, 1)`.

---

## 7. Non-negotiables this design must not break

- **CLAUDE.md §2 r4** — reduce-motion. Every mechanism gated; no content hidden by motion, in any
  state, including during a delay. `animation-fill-mode: both` holds an element at its `from`
  value for the whole delay, which is why both kill-switch blocks carry
  `animation-delay: -1ms !important`. Do not "simplify" those lines away.
- **CLAUDE.md §2 r5 / WCAG AA** — keyboard reach and focus order unchanged; no scroll hijack that
  strands a keyboard user; no motion that moves a focus target out from under the caret.
- **Zero layout shift.** Transform and opacity only. §6's mascot/rail alignment is asserted to 1px
  in e2e and must stay exact. Document height at 1280 is 4480px and is a settled figure.
- **No new DOM nodes where an attribute will do** — the pattern Task A-MOTION established.

---

## 8. Explicitly out of scope

- **Every playbook Source-A device** (video scrub, scene-carousel, interstitial, ambient loop).
  `public/marketing/` holds six PNGs and no video, and CLAUDE.md §2 r1 forbids sourcing video from
  YouTube. Producing original footage is a separate project.
- **Preloader counting 000→100 with a wipe.** It withholds content behind a deliberate blank
  screen on a learning product's marketing page.
- **Horizontal-scroll pin for §3.** The conveyor is the metaphor; a pinned horizontal track is the
  highest-risk device for reduce-motion and keyboard users, for the smallest gain here.
- **Cursor-reactive canvas constellation in §2.** The SVG line-draw carries the same reading with
  no canvas and no second JS surface. Revisit only if §2 reads flat once built.
- **A mascot SVG rig.** All 32 poses are PNG; eye-tracking would need new art. Not in this design.
- **Any change to §4 or §6.** See their FROZEN entries.
- **Mobile landing page.** Still blocked on two owner questions, unchanged by this spec.

---

## 9. Testing

- **The motion gate** — unit tests over both inputs and their four combinations, including the
  app toggle mutating after mount. The one piece that must be proven.
- **The scroll-progress provider** — unit tests for the `[0,1]` mapping at section boundaries, for
  deactivation when out of view, and for the write-final-value-once path when motion is off.
  Teardown asserted (no leaked rAF or observer).
- **The thread token contract** — a CSS-source assertion that every segment consumes the shared
  tokens and none defines its own width, accent, cap or easing. This is what makes continuity
  checkable rather than aspirational.
- **CSS-source assertions in `lib/design-tokens.test.ts`** — every new hidden rule carries the
  failsafe escape; the rule count is pinned; no new duration/easing literals. Deterministic, and
  they cannot miss a timing window.
- **e2e per section** — a behavioural check that each mechanism completes, plus the existing
  `motion never hides content` sweep extended to the new rules. ⚠️ Each new e2e case needs a
  **positive control** asserting the armed state before watching the release; a case without one
  passes vacuously against a build that stopped arming at all.
- **Reduce-motion is checked by sampling every frame through load**, not by one assertion. The
  §2 r4 defect found on 2026-09-04 passed a single-sample e2e 21/21 twice and fired roughly
  1 run in 12.
- **Two acceptance criteria are visual and no test can carry them:** §2 reading as a system, and
  §3's hand-off feeling natural. These are render reviews with the owner. A green suite is not
  evidence for either.
- Guards written over code that already exists **cannot fail first** — mutation-check them and
  report both outputs (CLAUDE.md §7).

---

## 10. Size and sequencing

This is a large spec — roughly a dozen tasks — and it sits at the upper edge of one implementation
plan. It stays one plan because the doctrine in §2 binds every piece: splitting it would let the
sections be built against drifting interpretations of the same four rules.

Build order, owner-approved 2026-09-04. Hardest engine first, sections after, never the reverse:

| Phase | Work | Why here |
|---|---|---|
| **0** | Motion gate · scroll-progress provider · thread tokens + contract test | Nothing may be built before the gate; the token contract must land before any section renders a segment, so no section defines its own dialect first |
| **01** | **§5 i+1** | The motion laboratory. Wiring, not invention — hooks and geometry exist. Exercises reveal, SVG geometry, progress, timing, the gate and reduce-motion at the lowest risk, and closes the stale-docblock defect early |
| **02** | **§1 Hero** | The architecture proof — the only scroll-progress-driven section |
| **03** | **§2 System** | Render test: do six chips read as a system? |
| **04** | **§3 Pipeline** | Render test: is the hand-off natural? |
| **05** | **§7 Privacy** | Quiet motion |
| **06** | **§8 CTA** | Invitation |
| **07** | **§9 Signoff** | Thread resolution |
| — | **§4 and §6** | **No task. No refactor. No "improve."** |

## 11. Open items

1. **§1's scroll distance** — over what distance the video card travels `1.00 → 0.94`. Measured at
   1280 and at 390, after a render.
2. **§3's hand-off timing** — overlap, hold, and enter-transform, decided against a render.
3. **§2's system reading** — whether the assembly reads as one system or as six cards arriving.
   The owner's eye, on a real render, before the section is called done.

All three are deliberately unfrozen. Both of the owner's §4 corrections came after every metric was
green, and both were about the picture.
