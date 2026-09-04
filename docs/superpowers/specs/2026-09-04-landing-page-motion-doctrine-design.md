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

---

## 3. The Korume Learning Thread

One through-line, four morphologies. The reader is never told these are the same line; continuity
is felt, not announced. It may disappear for a section and return — the gap is what makes the
return legible.

| State | Shape | Where |
|---|---|---|
| **LINE** | `────────` | transitions between sections |
| **CONNECTION** | `●────────●` | §2, where the system is assembled |
| **PATH** | `● ╲ ● ╲ ●` | §6, the learning path |
| **KNOWLEDGE CURVE** | `───╮ ╰──╮ ╰──` | §4, where the line becomes pitch |

The thread's journey ends at **§9 Signoff**, not at §8 CTA. The CTA is an invitation sitting on
the path; the Signoff is the resolution. This was an explicit owner ruling, 2026-09-04, and it
resolves a real gap: the page has nine sections and the first draft of this narrative had eight.

### 3.1 The thread is not one element

⚠️ **The thread is a shared visual language, not a single DOM node spanning the page.** Each
section owns its own thread element, sized and positioned inside that section. They are bound by
shared tokens — one stroke width, one accent, one draw mechanism (`stroke-dashoffset`), one easing
— so that a segment ending at a section's bottom edge and the next beginning at the following
section's top edge read as one line continuing.

This is deliberate and it is the cheaper *and* the more robust choice. A single spanning element
would have to be positioned across section boundaries that already carry settled geometry (§6's
rail alignment is asserted to 1px), would fight every responsive reflow, and would put one
element's failure in charge of the whole page's through-line. Per-section segments degrade one
section at a time.

**The continuity obligation is therefore a test, not a wish:** the segments' shared tokens must be
asserted from CSS source, so a change to one section's thread that silently desynchronizes it from
the rest goes red.

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

| § | Section | Metaphor | Verb | Status |
|---|---|---|---|---|
| 1 | Hero | Cinematic camera push | **Enter** | NEW |
| 2 | Problem | Node assembly / orbit | **Understand** | NEW |
| 3 | Journey | Learning conveyor | **Connect** | NEW |
| 4 | PitchShowcase | Pitch-line draw | **Experience** | ✅ **ships already — do not rebuild** |
| 5 | Recommendation | Calibration scanner | **Discover** | NEW |
| 6 | CapabilityChain | Learning path | **Build** | ✅ **ships already — do not rebuild** |
| 7 | Trust | Quiet lock | **Trust** | NEW |
| 8 | Cta | Invitation | **Begin** | NEW |
| 9 | Signoff | Thread resolves | **Rest** | NEW |

### §1 Hero — camera push

The page's most expensive motion. The section is a two-column grid: copy plus two CTAs on the
left, `HeroVideoCard` on the right (which owns the `hero-still.png` frame, the transport bar, the
sentence rail and `greeting.png`).

On entrance, in order: the still settles from `scale(1.04)`; the heading reveals line by line; the
subtitle; the two CTAs; then the video card's own interface — transport bar, then sentence rail,
then the mascot; then the first thread segment.

On scroll: the video card scales `1.00 → 0.94` and lifts as the section leaves, and the thread
draws downward, handing the reader to §2.

⚠️ **The heading's line-by-line reveal needs a line-splitting decision.** The heading is one
catalog string; splitting it into lines in the DOM means either a JS measure pass or a hard-coded
break, and both are fragile across two locales and every viewport width. Simplest sufficient
option: reveal the heading as one unit with a mask-rise rather than per line, and spend the extra
beat on the video card's interior instead. Resolve against a render before building.

This is the one section whose motion is scroll-*progress* driven rather than entrance-triggered.

### §2 Problem — node assembly

The six chips are not six cards. They are six parts of one system: Vocabulary, Grammar, Kanji,
Pronunciation, Listening, SRS. They arrive scattered and assemble; the constellation's lines then
draw between them (`stroke-dashoffset`, the mechanism §4 already uses). The centre sentence lands
last.

The reading this earns: *"Korume doesn't teach these separately."*

### §3 Journey — learning conveyor

Five steps, handed off rather than revealed together: video frame → subtitle highlight → word
extracted → meaning → review card. Each step wakes as the thread reaches it. Horizontal in
feeling, but **not** a horizontal-scroll pin — the playbook's lineup device is deliberately
softened here (see §8 of this spec).

### §4 PitchShowcase — already correct

Reference contour draws, learner's contour follows, four sub-scores settle, overall number appears.
Keep exactly as is. Two constraints, both already enforced in `app/globals.css`:

- **`87` does not count up.** Ruled 2026-09-04, ruling upheld. Animating the digits puts a second,
  transient value on screen for a number the copy states once — a false reading for anyone who
  glances mid-animation, on a page about pronunciation scoring.
- The dash declarations must be repeated on the `"in"` rule, not only on `"pending"` — a
  `@keyframes` block with only a `to` takes its `from` from the live computed value.

### §5 Recommendation — calibration scanner

A different mechanism from §4 on purpose. Known vocabulary scans, then the new lesson resolves,
then the donut arc sweeps `0 → 96` via `stroke-dashoffset`. The `NEW` word reveals last.

**The donut sweep is geometry, not digits, so it is not covered by §4's ruling.** The component
was authored for exactly this: `recommendation-donut.tsx`'s docblock states the arc was built as a
`stroke-dasharray` sweep *"because that is the one shape a later `stroke-dashoffset` tween can
animate without re-authoring the geometry"*, and it already carries `data-familiar-donut` /
`data-familiar-arc` hooks that no CSS rule consumes today. This section is wiring, not invention.

⚠️ That docblock also says *"The whole-page motion pass is a later task"* — false since Task
A-MOTION. It must be corrected in the same change, or the file keeps arguing its reduce-motion
obligation from a premise that stopped being true.

The metaphor is **discovery/calibration**, not growth: *"Korume is finding the right next thing
for me."*

### §6 CapabilityChain — already correct

Eight cells cascade in DOM order, connectors and rail dots one beat behind, the mascot standing at
the endpoint. Keep. `xl:items-end` is load-bearing and pinned in e2e — the node grid's bottom edge
is the rail.

### §7 Trust — quiet lock

Intensity drops to roughly 30–40% of §1. No playful motion; this section is about privacy
(*"Your recordings stay private"*, *"Your data is yours"*, *"AI with clear boundaries"*). The
thread arrives, enters a lock, and stops. The three cards then arrive slowly, in sequence. This is
the page's breathing room before the CTA.

### §8 Cta — invitation

A new scene, not a continuation. Background settles `1.03 → 1.00`; the orb floats; the mascot
breathes almost imperceptibly; the CTA reveals last. The thread becomes a short path into the
button.

### §9 Signoff — resolution

The thread slows, softens its curve, loses opacity, and settles. It does not vanish abruptly. The
footer below it is fully still, with `resting.png` asleep on its book.

---

## 6. Architecture

Approach C, chosen 2026-09-04: **CSS for every section mechanism, exactly one JS engine.**

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
- **Mobile landing page.** Still blocked on two owner questions, unchanged by this spec.

---

## 9. Testing

- **The motion gate** — unit tests over both inputs and their four combinations, including the
  app toggle mutating after mount. The one piece that must be proven.
- **The scroll-progress provider** — unit tests for the `[0,1]` mapping at section boundaries, for
  deactivation when out of view, and for the write-final-value-once path when motion is off.
  Teardown asserted (no leaked rAF or observer).
- **CSS-source assertions in `lib/design-tokens.test.ts`** — every new hidden rule carries the
  failsafe escape; the rule count is pinned; no new duration/easing literals. These are
  deterministic and cannot miss a timing window.
- **e2e per section** — a behavioural check that each mechanism completes, plus the existing
  `motion never hides content` sweep extended to the new rules. ⚠️ Each new e2e case needs a
  **positive control** asserting the armed state before watching the release; a case without one
  passes vacuously against a build that stopped arming at all.
- **Reduce-motion is checked by sampling every frame through load**, not by one assertion. The
  §2 r4 defect found on 2026-09-04 passed a single-sample e2e 21/21 twice and fired roughly
  1 run in 12.
- Guards written over code that already exists (§4, §6) **cannot fail first** — mutation-check
  them and report both outputs (CLAUDE.md §7).

---

## 10. Size and sequencing

This is a large spec — roughly a dozen tasks — and it sits at the upper edge of one implementation
plan. It stays one plan because the doctrine in §2 binds every piece: splitting it would let the
sections be built against drifting interpretations of the same four rules.

Build order follows playbook §2 — hardest engine first, sections after, never the reverse:

1. **The motion gate.** Nothing else may be built before it; every JS consumer depends on it, and
   it is the one piece whose failure is a CLAUDE.md §2 r4 defect.
2. **The scroll-progress provider**, on top of the gate.
3. **The thread's shared tokens and its CSS-source continuity test** — before any section renders a
   segment, so no section can define its own dialect first.
4. **§5 Recommendation.** Deliberately first among the sections: it is wiring, not invention (the
   hooks and geometry exist), so it exercises the whole stack end to end at the lowest risk, and it
   closes the stale-docblock defect early.
5. **§1 Hero** — the only scroll-progress-driven section, and the one that proves the provider.
6. **§2, §3, §7, §8, §9** — entrance-driven, independently buildable once 1–3 land.
7. **§4 and §6 are not tasks.** They ship correct. Any change to them in this work is a regression.

## 11. Open items

1. **§3's hand-off timing** is described qualitatively. The exact per-step offsets should be
   chosen against a render, not derived on paper — both of the owner's §4 corrections came after
   every metric was green and both were about the picture.
2. **§1's scroll range** — over what scroll distance the product preview travels `1.00 → 0.94` —
   needs a measurement at 1280 and at 390, not a guess.
3. Whether §2's assembly reads as a system or as six cards arriving is a judgement that needs the
   owner's eye on a real render before the section is called done.
