# ⛔ ARCHIVE — the landing-page port's full narrative, sessions 1-6

> **This is history and evidence, not a next action.** The live file is
> `mem:landing_page_port_run_state`, which is short on purpose and carries every ruling that still
> binds. Open THIS file only when you need the reasoning behind one of them — it is ~96KB and does
> not fit in one read, so grep it rather than opening it whole.
>
> Split on 2026-09-03 (session 6) because reading it had become the expensive part of starting a
> session: it exceeded the read limit and forced a temp-file-plus-grep dance every time.
> **Nothing was deleted.** Everything below is exactly as it was written.

---

# Landing page port (`/`) — run state

> **Status 2026-09-03 (FOURTH working session of the port; later than every note below).** Tasks 1–7 ·
> A1 §2 · A2 §3 · A3 §4 · P · 8 §5 · 9 §6 · 9b · 10 §7 · 11 §8+§9 · 12 · **TASK V** · and now
> **§1's two owed owner decisions** and **§4's contour rebuild** are all built and committed on branch
> `landing-page-port`. **Nothing merged, nothing pushed.**
>
> ▶ Gate, every command run and read before anything was written about it: `npx tsc --noEmit` exit 0 ·
> `npm run lint` 0 errors · `npx vitest run` **2578 over 280 files, 0 failed**. Working tree clean.
>
> ⚠️⚠️ **EVERYTHING BELOW IS THE FOURTH SESSION. TWO MORE RAN ON 2026-09-03.**
> Read `## ✅ SESSION 6 — TASK 13 IS BUILT AND COMMITTED` near the bottom FIRST, then
> `## ✅ SESSION 5`. In short: the independent review is **DONE**; **Task 13 is DONE and committed
> at `9cebadd`**; HEAD is **`9cebadd`**, the suite is **2589 unit / 27 e2e**. §0 now has a
> hamburger + sheet, which **reverses the 2026-08-28 "no hamburger" ruling at the owner's own
> direction**. What remains: **Task A-MOTION · the whole-branch review · the lessons pass · and a
> NEW, LARGE piece — the owner's mobile landing page**, deliberately scoped out of Task 13.
>
> ~~STILL NO INDEPENDENT REVIEW, AND THE GAP IS NOW THREE RANGES WIDE.~~ ✅ Closed by session 5.
>
> ⚠️ **`.next` NO LONGER HOLDS A PRODUCTION BUILD.** This memory used to say it did and that
> `npm run start` was ~1 s. `BUILD_ID` is absent — a `next dev` run clobbered it, exactly the hazard
> already recorded below. `npm run start` will fail; `npm run build` first, or use `npm run dev`.
>
> ⚠️ **This memory is navigation, process and the decisions taken on the owner's behalf. It
> deliberately does NOT restate the design or the plan.** The spec and the plan travel with the repo;
> this does not. If this file and either of them disagree, they win and this file is the bug.

# ▶▶ RESUME HERE

**Run `git log --oneline -8`.** The last hash this file can honestly state is **`08633cd`** (session
5's last §4 commit — the two-different-waves fix); anything after it was written by a later session.
⚠️ The two hashes listed just below are session 4's and are NO LONGER the tip — session 5's five
commits sit on top of them, listed in `## ✅ SESSION 5`. A file cannot name the commit that
contains it — writing one means predicting it, and a predicted number formatted as a measurement is
the L-002 failure this branch has paid for four times now.

    44c56f3  feat(marketing)  §1 — player chrome (timestamp + 4 control glyphs) and the third key word
    81ff680  fix(marketing)   §4 — the pitch contour rebuilt as a speech intonation trace

## ▶▶ THE NEXT ACTIONS, IN ORDER

> ⚠️⚠️ **THIS LIST IS SUPERSEDED. The 2026-09-03 FIFTH session did items 1 and part of 4.**
> Read `## ✅ SESSION 5` near the bottom of this file FIRST — it closes the review gap, corrects
> Task 13's aim, and lists what actually remains. The four items below are kept only because their
> wording is what the superseding section argues against.

1. ~~**An INDEPENDENT render-capable review of `19b05d5..HEAD`.**~~ ✅ **DONE, all three passes.**
   Report: `.superpowers/sdd/2026-08-27-landing-page-port/review-19b05d5-HEAD-report.md` (555 lines).
   With fixes · 0 Critical · 9 Important · 7 Minor. Do not re-raise this.
2. **Task A-MOTION** — one pass over the whole composed page, plus the unexplained `/en#problem`
   scroll drift, which belongs to whoever owns the scroll layer. **STILL OPEN.**
3. ~~**Task 13** — re-measure the 320/390/768 overflow.~~ ✅ **RE-MEASURED, TWICE, INDEPENDENTLY —
   AND THE ATTRIBUTION IN THIS FILE WAS WRONG.** The three numbers reproduce EXACTLY, but the cause
   is NOT §3's `shrink-0` + `basis-[clamp(...)]` row. See `## ✅ SESSION 5`. Task 13 is still open;
   it is now aimed at `--text-hero` and the footer.
4. **Whole-branch review**, then the branch-end `docs/lessons.md` pass — now **EIGHT** queued entries
   (two L-002 evidence entries · `npx playwright test` belongs in the gates · that same e2e gate is
   unrunnable from cold · the window-vs-page pattern, three instances · a plan step can carry a
   correct measurement and a wrong cause · **new: choosing the wrong METRIC survives four rejections
   in a row** · **new: a phrase-level claim must be measured on a phrase-level signal**).

## ✅ §1's TWO OWED OWNER DECISIONS ARE CLOSED (`44c56f3`, 2026-09-03)

This memory carried both to the owner as blockers. They ruled: *"4 nút tùy bạn, trông sao cho đẹp,
không cần mang tính hứa đâu, bởi vì tôi tin là màn luyện tập shadowing còn đặc sắc hơn nhiều"* — and
delegated the catalog key too. **Both are built. Do not re-raise them.**

- The transport bar now carries an elapsed timestamp and FOUR glyphs (subtitles · repeat · volume ·
  fullscreen). The §2.3 constraint that they DEPICT and never function is untouched and asserted.
- ⚠️ **The timestamp shows ELAPSED ONLY, deliberately.** `hero.video.duration` ("13 min") is already
  four rows above it, so a "0:24 / 13:00" readout would put one fact in two places by hand — a
  CLAUDE.md §6 defect, not a trade-off. Do not "complete" it.
- The third key word is 落ち着く（おちつく）· calm, drawn from the rail's OWN sentence
  (落ち着きます). A test pins that RULE — a replacement word not occurring in the sentence would be
  new study content, which is the owner's.
- ▶ **The catalog-leaf guard did the whole TDD job with no new test written.** Adding a key without
  rendering it moved `expect(allLeaves).toHaveLength(29)` to 32 and failed loudly. That guard is
  worth copying to any other section with a catalog subtree.

## ⚠️ §4's CONTOUR: FOUR REJECTIONS, ONE ROOT CAUSE — I KEPT MEASURING THE WRONG THING

The single most expensive lesson of this branch so far. The graphic was rejected four times and every
time I controlled a quantity that was not the one making it look wrong:

1. The original: 40 monotone frames, two lazy S-curves. Owner: *"cái sóng tôi muốn đặc sắc hơn"*.
2. **A3** read that as DENSER: ±3.9 Hz of INDEPENDENT per-frame jitter, drawn with `L` commands so
   every one of ~169 samples was also a corner. Owner: *"trông rất xấu"*.
3. My first fix bounded the **SLOPE**. That outlawed the near-vertical closing lift the owner's own
   reference ends on, and smoothed the trace to SEVEN direction changes — a lazy curve again.
4. My second bounded the **BEND**, and I loosened it twice, telling myself each time there was a
   reason. There was: **the reference IS sharp. Sharpness was never the defect.**

▶ **The defect was INCOHERENCE.** A3 drew each frame independently of its neighbours, so the line
had no direction from one sample to the next. **No single-frame statistic sees that** — measured, A3
bent 10.30 with 71 direction changes and the shipped version bends 5.60 with 38, the same
neighbourhood. The **lag-1 autocorrelation of the first differences** separates them cleanly:
**0.327 against 0.720**. That is now the guard; bend and run-length are demoted to labelled coarse
backstops with their weakness and their numbers written into the test.

▶ **The tell I ignored: I loosened the same threshold twice.** Once is a tuning. Twice means the
threshold is measuring the wrong thing. Stop and find the metric that separates the accepted case
from the rejected one — I had both populations on disk the whole time and could have measured this
in one command.

⚠️ **PERIOD AND AMPLITUDE ARE SEPARATE DIALS AND I TURNED THEM TOGETHER TWICE.** The owner's
corrections were precise about this: first *"giống những tia sét"* (sharper — a dash-wave shape
problem, fixed by using TRIANGLE waves instead of sines, whose extrema are round and scallop when
sampled per frame), then *"thêm mật độ… có độ sâu và cao hơn"*, then *"sâu hơn, và biên độ (chiều
ngang) bớt dày hơn"* — i.e. deeper AND less crowded, which is one dial each. Shipped: periods 8/13/22
frames, amplitude ~10.4 Hz.

⚠️ **A PHRASE-LEVEL CLAIM MUST BE MEASURED ON A PHRASE-LEVEL SIGNAL.** When the detail layer reached
~10 Hz, the "You track never releases" test went red at 29.7 against a bound of 26 — and the bound
was RIGHT. A raw 40-frame window answers partly about the sentence and partly about where a detail
trough happened to land; it inflated the apparent release by ~10 Hz. The fix was a 9-frame centred
mean (one frame wider than the fastest detail period), not a looser number. **Resisting the
threshold nudge is what found the real bug.**

⚠️ **THE UNVOICED GAP IS GONE FROM THE FIXTURE, AND THAT IS DELIBERATE.** The owner asked why the
line kept breaking in the middle. A native speaker does not pause between 日本の秋は and とても: the
phrase boundary is a pitch VALLEY, and a hole showed nothing at all. **`toPath` still renders gaps
and `contour-path.test.ts` still pins that — the product's real overlay depends on it.**

⚠️ **BOTH LINES ARE SOLID NOW — WCAG 1.4.1's cue is STROKE WEIGHT, and that is weaker.** The owner
ruled explicitly (*"k sợ dính vào luật nào cả"*). Recorded in `pitch-chart.tsx`'s docblock rather
than waved through, with the stronger remedy named (a small direct label at each line's end). **If a
reviewer raises 1.4.1 here, it is a known, owner-accepted trade, not an oversight.**

▶ **Measured on the shipped fixtures, native / you:** range 167.2–233.6 / 172.3–207.4 Hz · peak
region 233.6 / 202.0 (a 31.6 Hz gap on とても) · release 46.1 / 19.7 Hz over 40 smoothed frames ·
direction changes 38 / 37 · coherence 0.720 / 0.697 · bend 5.60 / 5.20 · one unbroken subpath, 168
curve segments, zero line segments.

## ▶ HOW THE SESSION FOUND THE BUG IT WAS ASKED ABOUT — THE OWNER POINTED AT THE WRONG WAVE

The session opened with *"phần waveform nó vẫn chưa thay đổi gì"*. §3's waveform HAD changed and
rendered correctly — measured live: 32 bars, 1.784 px each, range 16.81, matching `92b8214` exactly.
The owner then sent a screenshot: they meant **§4's contour**, a different component Task V never
touched.
▶ **A report that a fix "didn't work" can be about a different thing entirely. Ask for the picture
before re-opening the fix.** Measuring §3 first cost two minutes and prevented un-fixing a good fix.

## ⚠️ WHAT TASK V CHANGED ABOUT WHAT THIS MEMORY USED TO SAY

**The §6 open question this memory carried to the owner was built on a cause nobody had checked, and
it does not need asking.** It said the companion could only grow by narrowing the 8-node grid or by
overflowing its column (triggering T9-R4's three-mechanism rule and contradicting the docblock's
"NOTHING OVERLAPS HERE"). Neither is needed:

**`reading-on-the-orb.png` was never trimmed** — it filled 82.6% x 90.8% of its own 499x500 frame,
so in a 160px box the creature drew 132 x 145 CSS px and sat 5.6px LEFT of centre. The other three
poses a component references are `extract.js`'s output and measure ~100% fill, because a cutter
emits a tight box. Trimming the two hand-cut ones bought a **21% larger, centred creature for zero
grid pixels** (companion now 160 x 176, node grid still 1016).
▶ **Before writing an open question about a trade-off, check whether the thing being traded is the
constraint.** The 16px of "slack" was real and irrelevant.

⚠️ **`xl:items-end` on §6 IS CORRECT — do not "fix" it.** The plan I wrote told the implementer to
centre the companion, reasoning from a real measurement (its centre is 74.67px below the icon-tile
row's). The measurement is right and the cause is wrong: the docblock already says `items-end` is
what puts the orb on the RAIL, the node grid's bottom edge IS the rail, and the reference draws it
that way. What looked wrong was the same untrimmed file — 16px of bottom margin, so `items-end` was
pinning the MARGIN to the rail and the creature floated 5.1px above it. **That is the §6 minor
already on file as "the orb floats ~14px above the rail": the same defect, filed twice.**
▶ **Read a class's own docblock before changing a class that has one.** The plan is corrected at
`23662ac`; an e2e guard now pins the rail contact, mutation-checked.

⚠️ **§3's card 1 leading with the still, label below, is CORRECT and closed.** The owner raised it
as an inconsistency; `ref/zoom-c1.png` draws it that way and the still is **70%** of the card's
height in both. Reversing it is one line (lead `WatchBody` with `StepHeading`) and a deliberate
departure from the reference — the owner's call, not a defect.

## ▶ THE TWO THINGS TASK V LEFT FOR THE OWNER (V4 Step 1)

Most of §1 already matches `ref/s1-hero-card.png`. Two gaps, and building either would take a
decision that is not mine:
1. The reference's transport bar carries a **timestamp and four control glyphs**. Adding them means
   choosing which affordances to depict, and depicting a control implies the feature (spec §2.3).
2. Its **Key Words list has three entries against our two**. A third needs a new catalog key, and
   the catalog is the owner's — A2's ruling on §3 card 2's romaji and chip applies unchanged.

✅ **V4 Step 2 is CLOSED as verified-harmless.** §2's photograph at a LAYOUT width of 1024 overruns
its fade by **16.29 px** behind the SRS chip (photo 599.04..1024, fade 84.99, chips end 700.32,
overlap 101.28). A1 recorded ~16 and it re-derives; Task 12's widening did not move it. Every chip
is an opaque `bg-card` panel at `relative z-10`, so nothing reaches its text. Lengthening the fade
to clear 1024 would over-fade at 1280, the reference's own width.
▶ **A same-origin iframe carries its OWN 15px scrollbar: a 1024px iframe lays out at 1009 and drops
below the `lg` branch entirely.** Ask for 1039, and read `clientWidth` back before believing it.

## ▶ THE MEASUREMENT RULES TASK V PAID FOR AGAIN

- ⚠️ **The page here is 1265, not 1280** (window 1280 less a 15px classic scrollbar). Every
  percentage or distance-to-edge is worthless without the page width beside it. Three numbers on
  this branch were recorded wrong this way; this session avoided a fourth.
- ⚠️ **A number can be right and still describe the wrong subject.** My first §6 e2e guard compared
  the companion's centre to `[data-chain-node]`'s and went red at 13.19 against a 12px bound — which
  looks like a working guard and is not: the node is the whole 186.67px CELL, so `items-end` puts
  the centres 13.33px apart BY DESIGN. The 74.67 belongs to the icon-TILE row, a different element.
- ⚠️ **Change one constant at a time when two are suspected.** §3's waveform had two independent
  causes; fixing the bar count alone left the dynamic range at 4.67, which is what PROVED the 0.18
  floor was a second defect and not a symptom.
- **`encode` in `scripts/mascot/png.js` is `encode(w, h, data)` with a Buffer** — not an object, and
  not a `Uint8Array` (it calls `data.copy`). `decode(path)` takes a path, not a buffer.
- **The JWT skew recurred and the recorded procedure worked verbatim.** `auth-locale-round-trip`
  went red with digest **1612785857** — the same one already on file — and `date -u` gave host
  12:49:34 against the container's 12:49:35. Passed on re-run. Read the digest first; it is the join
  key between the browser and the server log.

## ✅ TASK 12 IS REVIEWED — PASS. WHAT THE REVIEW SETTLED, AND WHAT IT DID NOT

Full report `task-12-review.md`; the reasoning is in the ledger. **PASS, 0 Critical, 0 Important,
1 Minor.** All six flagged claims re-derived: the reference viewport (1280, straight from
`get_screenshot` on `347:6277` — the anchor of the whole width argument) · the 1256 arithmetic and
its live render (content starts 44.0, width 1192) · the scope call (**36** consumers, **3** marketing
files, **4** call sites — widening `Container` would have hit **33 unrelated files**) · the showcase
at 828.578 · §7 · and the mutation-check, re-run and holding (removing `lg:w-[78%]` drops the strip
226.3 — **44.0**, under the test's `>150`).

⚠️ **N1, THE ONE MINOR: A RENAME REWRAPPED A LINE AND DROPPED A WORD.** `Container` —
`MarketingContainer` turned *"It changes nothing for sections that don't"* into *"It changes for
sections that don't"* — the opposite claim, in the sentence explaining why `relative` is
unconditional. Fixed.
▶ **A hunk-by-hunk read shows that line as "renamed", not as "meaning reversed".** Read a rewrapped
sentence WHOLE against its pre-rename form. Cheap, and repeatable on any rename that reflows prose.

⚠️ **THE WINDOW-VS-PAGE ERROR FIRED A THIRD TIME, AND IT IS NOW A PATTERN WORTH A LESSON.** The
ledger's §7 numbers (82.7%, strip 218.6px) would not reproduce; I measured 82.32% / 226.3px. Neither
is wrong: **the earlier run had a 15px classic scrollbar, so its page was 1265 wide, not 1280** —
modelling 1265 reproduces 82.70% / 218.79px to the decimal. With `/en#signoff`'s scroll room and
`poses.json`'s diff-line count, that is three.
▶ **One shape: a fact about the measuring WINDOW recorded as a fact about the PAGE.** A
percentage-of-page or a distance-to-page-edge is not a property of the layout unless the page width
is written beside it. Queued for the branch-end lessons pass.

▶ **NOT verified by that review, and left open rather than passed**: §6's between-tile gap (named
as closed by task 12, but the diff never touches `capability-chain.tsx`, and `[data-chain-node]`
resolves to the grid CELL — 8 x 127px, zero inter-cell gap — not the visible tile), and the 3.46%
pixel scan of `346:6275` itself (anchor and arithmetic confirmed; the scan not re-run).

▶ **The overflow sweep is PRE-EXISTING and a cold reviewer WILL misfile it.** 320 -> +87 · 390 ->
+17 · 768 -> +11, identical to the numbers already recorded against **Task 13**; below `lg` the new
`max-width` does not bind at all. Keep it visibly assigned to Task 13.

## ✅ SUPERSEDED — TASK V IS IN THE PLAN NOW, AND EXECUTED (kept for its evidence)

> Everything below was written while Task V existed only as one line in a gitignored file.
> It is now written into the committed plan (`95f77b5`) and executed (`92b8214` / `d720eb7` /
> `7afc664` / `4af5646`), and the plan's own "What Task V actually did" section is the
> current record. **The three measured defects below are kept because the numbers are the
> evidence — but read the RESUME block first: defect 3's stated cause is WRONG.** The
> companion was not a composition trade-off, it was an untrimmed PNG, and `xl:items-end` was
> right all along.

### The original note, as written

**Task V exists ONLY as one line in the gitignored ledger** — *"visual fidelity vs `346:6275`"* —
carrying two parked items. The committed plan has Tasks 1—13 and no Task V, no Task A-MOTION and no
Task A-STATIC. **Task 13 explicitly refuses this work**: *"change `py-2xl` in `section.tsx`, NOT the
individual sections."*
▶ So the task that owns the owner's single biggest concern — whether the sections LOOK right —
dies with this working copy. Writing it into the plan is owed.

### The owner raised three defects on 2026-09-02. All three were measured, none guessed.

1. **§3's Shadow waveform is visibly BROKEN.** Root cause is scale, not data: the SVG is authored in
   a **160x52** unit box and renders at **102.5 x 33.3 CSS px** (0.64x). With `WAVE_BARS = 56` that
   is **~1.0 CSS px per bar with ~0.8px gaps** — sub-pixel, so bars alias away and the low-amplitude
   stretches vanish. `journey-art.tsx`'s own docblock says the envelope was shaped to read *"as
   speech at 130px wide"*; **it ships at 102.5px, narrower than the width it was designed for.**
   The gaps are also partly in the data: `syllables = 0.5 + 0.5*sin(17.4t)*sin(5.3t+0.4)` collapses
   to ~0 at several t, floored at 0.18. Fix direction: fewer bars (~28), or a higher floor, or
   shallower modulation — NOT a rewrite, and NOT a return to the pitch contour (ruled out
   2026-08-29, and a shipped test forbids it).
2. **§3's card row is internally inconsistent.** Verified from the DOM, not by eye (this controller's
   visual reads have been wrong twice — see that section):

       card         label offset from card top    first visual    width
       1 watch                  145                    13         146.5
       2 understand              13                    39         146.5
       3 shadow                  13                    39         146.5
       4 mine                    13                    39         146.5
       5 remember                13                    39         **162.5**

   **Card 1 inverts the order** — image first, label below — so "1 Watch" reads as a caption while
   "2 Understand" reads as a heading. And **card 5 is 16px wider**, from the `shrink-0` +
   `basis-[clamp(...)]` construct that is ALSO the 320/390 overflow already assigned to Task 13 —
   **one construct, two tasks; fix it once.**
3. **§6's companion is too small and misaligned — THREE separate causes, and one non-cause.**
   - Its column is only **176px** (the 8-node grid takes 1016 of the 1192 content), so the 160px box
     has just **16px** of slack. Making it bigger means taking width from the grid.
   - **`MASCOT_WIDTH = 160` was fixed BEFORE task 12 widened the page** (content 1088 -> 1192) and
     nobody re-derived it. The docblock derives 160 from the reference's 120 export px against the
     OLD container.
   - **Vertical**: the parent is `flex` with **`align-items: flex-end`**, so it bottom-aligns to the
     187px-tall grid and its centre lands **74.7px BELOW** the icon-tile row's centre.
   - **Horizontal**: `reading-on-the-orb.png` (499x500) has **asymmetric transparent padding — 26px
     left, 61px right**, 30 top, 16 bottom. The creature fills only 82.6% x 90.8% of its frame, so in
     a 160px box it draws **132 x 145 CSS px** and sits ~5.6 CSS px left of the box centre.
   - ⚠️ **NOT a cause: resolution.** `sizes="160px"` is correct and Next serves a 320px variant on
     a 2x display. Do not "fix" that.

▶ **The parked Task V items from earlier tasks are only two**, so these three roughly triple it.

## ▶ WHAT TASK 12 SETTLED

1. **`--layout-marketing-max: 1256px`, in a new `MarketingContainer`.** The reference's own viewport
   is **1280** — `get_screenshot` on `347:6277` reports `original_width` 1280x4028, a one-call
   question nobody had asked; every earlier estimate was a proportion. Scanning `346:6275` (a 0.675x
   render, 864x1821) for the most common bounded content edge puts the design's content **3.46%** of
   the page width in from each side; `max-w-6xl` put ours 7.5% in. Content measured after: **1192px
   from 1088**. §3/§4's showcase went **754 -> 828.57**.
2. ⚠️ **THE SCOPE WAS THE REAL FINDING: `Container` HAS 36 CONSUMERS AND ONLY FOUR ARE MARKETING.**
   Widening it would silently have re-laid-out every dashboard, kanji, vocab, shadowing, admin and
   auth screen. The old shorthand "Container is `max-w-6xl`, that's the lever" was the trap; the
   older phrasing "the real lever is `Section`'s max width" was right. Deliberately NOT
   `--layout-content-max` (the shadowing shell's width) — reusing it would make one edit move two
   unrelated surfaces.
3. **§7 was BROKEN by the widening and then fixed** — see its own section below.
4. **The e2e suite is real for the first time on this branch** — see its own section below.

## ⚠️ THE WIDENING BROKE §7, AND THE LEDGER HAD PREDICTED IT IN WORDS I MISREAD

§7's cards went 92.5% -> **97.1%** of the page and the photograph's clean strip fell **~81px -> ~37px**,
worse than before the task. The deferred note said *"widening only hides more behind an opaque card"*
— I had read that as being about widening the PHOTO; it applies to widening the PAGE too.
▶ **A deferred finding's wording describes a MECHANISM, not one lever. Re-read it against the change
you are actually making.** Put to the owner with a screenshot rather than guessed (composition is a
thing this owner has rejected before); ruled "stop the card row short"; fixed with `lg:w-[78%]`.

▶ **THE 82.6% WAS RE-DERIVED — AND THE METHOD I REACHED FOR FAILED FIRST.** Two scans of the
reference render could not produce it: at 665px wide a card's hairline border is SUB-PIXEL, and §7's
whole band reads full-bleed because the photograph runs to the page edge. What settled it:
**`trust.tsx`'s own docblock** already recorded the reference's three cards at 207..372, 379..543,
550..714 of an 864-wide page — task 10 measured it when it built the section, and **714/864 =
82.64%**. Plus an independent luminance-edge scan putting the photograph's READABLE content (the lit
window) at 88.9%, which 82.6% clears with room.
▶ **When an inherited number will not re-derive, look for where it was FIRST measured before
concluding it is unfounded.** It was one `grep` away, in a docblock, with its coordinates.
Measured after: cards end at **82.7%**, clear strip **218.6px**. Rendered and looked at: §7 now reads
as a lit shopfront at night with three cards beside it; before, three cards on black.

## ⚠️ NOBODY HAD RUN THE E2E SUITE WHILE THE NINE SECTIONS WERE BUILT

`tests/e2e/home.spec.ts` was **RED, all three tests**, and had been for the whole branch — it retyped
five English strings the owner has since re-voiced. The full suite was **13 passed / 3 failed**, and
every failure was the landing page's only e2e coverage. The plan's own task 12 would have added a
file next to it without noticing. ▶ **`npx playwright test` belongs in the gate list beside
`npx vitest run`.** Now `landing-page.spec.ts`, rewritten on task 9b's rule (routes/roles/DOM pinned;
wording from the catalog) and extended. **21/21.**
▶ **e2e can express what the unit suite structurally cannot** — this vitest environment loads no CSS,
so every geometric invariant here has been a class-presence proxy. Task 11's M1 and §7's photograph
strip are now real browser measurements. Task 13/V's owed Playwright pass is partly already here.

## ⚠️ THE E2E GATE CANNOT RUN FROM COLD — THE GATE THIS BRANCH JUST ADDED IS ITSELF BROKEN

`playwright.config.ts` gives `webServer` **120,000 ms** to run `npm run build && npm run start`.
A cold build measured **135 s** on this machine, so `npx playwright test` dies with
`Timed out waiting 120000ms from config.webServer` **before a single test runs** — and the tail of
the output is webpack cache warnings, which look like the problem and are not.
Workaround: `npm run build` first, then start the server yourself; `reuseExistingServer` is true
locally, so `npx playwright test` then picks it up and runs in ~24 s.
▶ Queued as a FOURTH branch-end lessons entry. Adding a gate to the list is not the same as
the gate being runnable, and this one fails in a way nobody would attribute to a config number.

## ⚠️ AN E2E RED THAT WAS NOT THE DIFF — AND THE DIGEST IS WHAT SETTLED IT IN ONE COMMAND

`journal.spec.ts` went red during the 2026-09-02 housekeeping. The browser showed
"Application error: a server-side exception has occurred", `Digest: 1612785857`. The production
server log carried **the same digest** against `PGRST303 / JWT issued at future`, plus one
`42501 permission denied for table vocab`. The local Supabase runs in **Docker**
(`127.0.0.1:54321`) and its containers read **~1—3 s AHEAD of the host**, which PostgREST does not
tolerate on a JWT's `iat`. Each error appeared exactly once; neither recurred across the two runs
after (single-spec, then a full **21/21**).
▶ **The digest rendered in the browser is the join key to the server log.** Without it this was
a coin-flip between "my change broke auth" and "flake"; with it, one `cat` of the log settled it.
▶ Recorded, not waved through (L-009): the skew is diagnosed but NOT fixed — the container
clock is still ahead, so this can recur. If a future e2e run goes red on a registration step, read
the digest first and check `docker exec supabase_db_nihongo-cinema date -u` against the host.

## ⚠️ L-002 FIRED ON ME AGAIN, IN THE SAME SESSION IT WAS RECORDED

**Both** of task 12's commit messages state a wrong suite total. `7dab407` says "over 279 files"
(stale — the new test file had made it 280); `9861650` says "2562/2562 over 279 files", **both
numbers wrong**. Measured: **2561 tests over 280 files, 0 failed**
(`npx vitest run --reporter=json`).
▶ **Root cause, and it is not ordinary carelessness: I chained `npx vitest run` and `git commit` in
ONE shell invocation, so the message was written BEFORE the output existed.** The number was a
prediction formatted as a measurement. **Never put a measured number and the command that produces it
in the same shell invocation.** Commits are immutable; the correction lives here and in the ledger.
▶ Also unresolved and recorded rather than waved through (L-009): **one full unit run reported a
single failure whose NAME I did not capture**; four later runs were clean. The branch has a known
`pitch-contour.test.tsx` flake and **I am not claiming this was it.**

## ▶ THE NEXT ACTIONS — EVERY TASK IS NOW BUILT AND REVIEWED

Tasks 1—13's predecessors, A1/A2/A3, P, 8—11 (+fix, re-reviewed PASS) and **12 (reviewed PASS,
2026-09-02)** are all closed. Task 12's three parked findings: §3/§4's showcase CONFIRMED closed
(828.578 measured), §7's photograph CONFIRMED closed, **§6's tile gap NOT verified — still open**.

Remaining, in order:
**Task V** (⚠️ see the section below — the owner raised three concrete defects on 2026-09-02 and this
task is where they live; it is ALSO the task with the biggest documentation gap on this branch) ·
**Task A-MOTION** (and the unexplained scroll drift below) · **Task 13** (⚠️ aimed at §3's card row,
the site header at 390px, and the unexplained 11px overflow at 768) · whole-branch review · the
branch-end `docs/lessons.md` pass, which now has FIVE queued entries: two L-002 evidence entries,
`npx playwright test` belongs in the gates, that same e2e gate being unrunnable from cold, and the
window-vs-page pattern that has now fired three times.

## ⚠️ THE FIX-ROUND REVIEW'S ONE MINOR WAS AN L-002 HIT ON ME, AND IT FIRED TWICE IN ONE COMMIT

Both numbers the reviewer could not reproduce were mine — and re-deriving them showed **both of us
had measured correctly**, which is worse than one of us being wrong, because it means the numbers
were never properties of the thing they described:

- **`/en#signoff` scroll room.** I wrote "420px", the reviewer measured 363.67. The quantity is
  `scrollHeight − innerHeight − scrollY`; `scrollHeight` (4422) and `scrollY` (3473.33) are
  IDENTICAL across both runs and only `innerHeight` differs (585 theirs, 531 mine). **It is a fact
  about the window, not about the page.**
- **`poses.json`'s pre-existing dirtiness.** I wrote "70 diff lines". `diff | wc -l` = **70** (mine —
  it counts the `NcN` separators too); `diff | grep -cE '^[<>]'` = **50**; `diff -u | grep -cE
  '^[+-][^+-]'` = **50** (theirs). Both outputs are real; I recorded one without its command.

▶ In both cases the load-bearing argument survives unchanged. **That is exactly why it is worth
keeping: the number that is DECORATIVE to the argument is the one nobody re-runs the command for.**

▶ **Also recorded, deliberately NOT filed: a one-time scroll drift on `/en#problem`.** One
measurement taken after a multi-second gap between two tool calls showed the page near the document
bottom with no interaction in between; a controlled re-test (fresh nav → immediate measure → two more
after 5s idle each) was stable and correctly anchored across 10s. Not reproducible, and not
attributable to the app (Lenis / ScrollTrigger) versus the tooling. **Worth a look during
Task A-MOTION**, which owns the scroll layer.

## ▶ WHAT THE FIX-ROUND REVIEW SETTLED BY MEASUREMENT — do not re-open these

- **`Section` is the RIGHT scope for the anchor clearance, not an under-fix.** `SiteHeader` has
  exactly ONE consumer (`app/[locale]/(marketing)/layout.tsx`); `grep -rl "sticky" components/ app/`
  returns three hits and the only other is `two-column-shell.tsx`'s sticky *sidebar rail*, not a top
  bar. Every `Section` importer is inside `components/marketing/`.
- **`4rem` is the right VALUE**, verified from the render function rather than the docblock:
  `headingBlock` is unconditionally the first IN-FLOW content in all three layout branches
  (`backdrop` is `position: absolute` and never displaces it), and `py-2xl` = 48px trivially absorbs
  the 0.667px gap to the bar's real 64.667px.
- **Class-presence assertions are the honest ceiling in this suite**, proven from prior art rather
  than from this fix's own docblock: `capability-chain.test.tsx` (pre-existing, unrelated) already
  records that this vitest environment loads no CSS, so `getComputedStyle` cannot see Tailwind's
  cascade. A real pixel assertion is owed to the Playwright pass Task 13/V already carries.

## ▶ WHAT TASK 11 SETTLED — Task 12 CONSUMES ALL OF IT

1. **`Section` now takes ONE `layout` prop: `"stacked" | "split" | "centred"`.** `split?: boolean`
   and the `rail != null` selector are RETIRED. `rail` is pure content and is accepted **only**
   under `layout="split"`, as a discriminated union — so both mistakes fix F6 guarded against are
   now compile errors, verified both ways with `tsc`. Each layout pairs an arrangement with its own
   measured heading token (40px / 24px / 28px); that is why it is one prop and not an `align` flag.
2. **`backdrop` is a NEW slot, and is NOT what §2/§7 use.** It renders as the section's first child
   OUTSIDE `Container`, for a layer behind the whole band including the copy. §2's and §7's
   photographs are PARTIAL bleeds scoped to the showcase column's edge and stay in `children`.
   **Do not migrate them** — they would lose their column-scoping and Container-relative bleed math.
3. **§9 is CENTRED**, reversing the plan. The pre-written reason to keep it left ("centred reads as
   a second CTA") was wrong at the hinge: **what makes §8 a CTA is its buttons, not its alignment.**
4. **§8's copy is `text-foreground`, not `text-muted-foreground`.** Over a photograph the muted grey
   measures 3.75:1 / 2.41:1 — failing AA. Raising the scrim to 80% still leaves the note at 3.49:1
   AND flattens the image; changing the text colour puts every block past 7:1. Because
   `object-cover` crops differently at every width, the bound was taken from the brightest pixel
   anywhere in the band rather than extrapolated: floor 6.82:1 across all six geometries.
   ▶ **Grey-on-photograph is the reusable lesson — a scrim is not what rescues a muted tone.**

## ▶ WHAT TASK 11's FIX ROUND ADDED TO THE METHOD

- ⚠️ **EVERY SECTION HEADING WAS LANDING UNDER THE STICKY HEADER, BRANCH-WIDE, AND ONLY §8/§9 MADE
  IT VISIBLE.** Nothing in the repo set `scroll-margin-top`. `/en#cta` put `#cta-heading` at 47.97px
  under a bar occupying 0..64.67px — ~17px of the section's ACCESSIBLE NAME (`aria-labelledby`)
  hidden. §2-§7 CONCEALED it: their `eyebrow` is decoration and is what lands in the strip instead.
  §8/§9 are the first sections with no eyebrow (correctly — no catalog key, and inventing one is
  inventing copy). Fixed at the primitive: `--layout-header-height` → `h-header` + `scroll-mt-header`.
  After: heading 47.97 → 112.14; the control `/en#problem`'s eyebrow 48.16 → 112.16, so §2-§7
  improved too.
- ⚠️ **`scrollIntoView()` DOES NOT REPRODUCE IT — only real hash navigation on a fresh load does.**
  That is why an implementer's browser pass, a self-review and a completion gate all missed it.
  **Add `/{locale}#<section-id>` on a fresh load to every section task's browser checklist.**
- ⚠️ **A NEW SHELL TOKEN HAS FOUR HOMES, AND `lib/utils.ts` IS ONE EVEN WHEN THE UTILITY IS
  UNAMBIGUOUS.** The A1-era note framed that fourth home as a `text-*` colour-vs-size hazard — the
  LOUD failure, where the class is silently dropped. The QUIET one applies to any custom name:
  unregistered, twMerge recognizes neither `h-header` nor `scroll-mt-header` and keeps **both sides**
  of a conflict, leaving CSS source order to decide. Measured: `cn("h-16","h-header")` →
  `'h-16 h-header'`. Homes: `globals.css` · `tailwind.config.ts` · `lib/design-tokens.test.ts` ·
  `lib/utils.ts`.
- ⚠️ **A NEW TAILWIND UTILITY THAT "DOESN'T APPLY" IS PROBABLY THE BROWSER'S CSS CACHE.** After the
  fix the page reported the header bar COLLAPSED to 36px and `scroll-margin-top: 0px`. The classes
  were on the elements and the rules WERE in the served CSS — `curl`ing the exact stylesheet URL the
  page had loaded proved it. A hard reload fixed it. ▶ **Curl the stylesheet the page actually
  loaded before touching the config.** (Separately: a `tailwind.config.ts` edit does NOT reach a
  running `next dev` — that one genuinely needs a restart.)
- **A FORMATTING FINDING NEEDS A BASELINE.** The review's N1 evidence was `prettier --check` warning
  on `poses.json` — but the file was ALREADY prettier-dirty at `9f2f8e6` (50 changed lines by
  `diff X Xf | grep -cE '^[<>]'`; the "70" first recorded here was `diff | wc -l`, which counts the
  `NcN` separators too — see the L-002 hit below), so
  `prettier --write` would have fixed a pre-existing condition and reformatted 40+ unrelated lines
  inside a task-11 fix commit. Hand-fixed the one entry to its siblings' key order instead, and
  compared both parses: identical content, key order aside. ▶ **Check whether the tool was already
  failing before the diff under review.**

## ✅ CLOSED BY TASK 12 — the max-width lever and its three findings (kept for the reasoning)

A2/A3's showcase shortfall · §6's residual tile gap (39.34px vs ~55) · and now **§7's photograph
reading as a narrower strip than the reference's**. All three are the same cause: `Container` is
`max-w-6xl` (1152) so at 1280 the content is 1088 and the gutters are 96 — where the reference's
content is ~1302 of a ~1400 page with ~49 gutters. §7's cards therefore end at 92.5% of the page
where the reference's end at 82.6%, which is why less photograph is visible. **Not fixable inside
§7**: the visible photograph is bounded by where the cards end, and widening it only hides more
behind an opaque card.

## ▶ WHAT TASK 10 ADDED TO THE METHOD (all paid for, all cheap to re-learn the hard way)

- ⚠️ **TWO `next dev` INSTANCES CLOBBER EACH OTHER, not just `dev` vs `build`.** Two servers on one
  working copy killed one with a webpack `rename 3.pack.gz_ ENOENT` and left the other serving
  `ChunkLoadError: Loading chunk app/[locale]/(protected)/layout failed` — while `curl` proved the
  server-rendered HTML was correct the whole time. Fix: kill every listener, `rm -rf .next`, start
  ONE. **Check the port before trusting a page**: 3000 was already taken, so `npm run dev` silently
  moved to 3001 and the first browser check hit a stranger's 404.
- ⚠️ **DO NOT FILE A VISUAL DEFECT OFF A DOWNSCALED SCREENSHOT.** At 1568px for a 1280 viewport the
  §7 photograph read as empty dark and was one step from being filed as missing. Measuring the `img`
  first (`complete`, natural 332x443, opacity 1, at left 936) and THEN zooming showed it renders
  correctly. Measure the element, then zoom — the same family as the §3 dot-grid error, caught
  before the claim this time instead of after.
- ⚠️ **A NEW COMPONENT FILE SILENTLY CHANGES THE SUITE TOTAL.**
  `components/ui/token-scale.test.ts` runs `it.each(sources)` over every file in
  `components/marketing/`, so each new component file adds one auto-generated Rule #0 case. Task 10's
  raw delta was +9 against 7 new tests; the gap was closed by diffing per-file counts from two
  `--reporter=json` runs, not by assuming. A task that records "+N tests" without knowing this will
  mis-explain its own delta.
- **The plan's per-task text was stale in FIVE ways this time** (8 needed 5 rulings, 9 needed 9).
  Worst: it pinned three English sentences as "verbatim" per spec §11 ruling 11, and **two of the
  three no longer exist** after the owner's copy pass — the plan's test was red on arrival. Also:
  a pending-slot assertion for a photograph committed since `b30661f`; `lg:grid-cols-[2fr_1fr]` where
  the reference draws a rail split with three equal cards; no mention of the three icons; and body
  copy in a rail the reference leaves empty.
- ▶ **"Verbatim promise" copy still derives from the catalog.** Ruling 11's real subject is that the
  three claims SHIP and none is dropped or emptied — not their bytes, which the owner re-voices.
  `trust.test.tsx` pins the KEY SET literally and derives every sentence. **Whether the current
  wording still states the `CLAUDE.md` §2 guarantees is a reading task for the owner, and the test
  deliberately does not pretend otherwise.**

## ▶ HOW TASK 10 WAS RUN — AND WHY IT NEEDED NO FIX ROUND

The user was ASKED how to run it (the session forbids spawning agents unasked) and chose **build
inline + ONE independent reviewer**. That kept the property that had caught a defect in every prior
section task, at one dispatch instead of two. It is worth repeating.

What the reviewer actually re-derived rather than accepted — this is what makes a PASS mean
something: it re-ran the `elementFromPoint` matrix and **found and reported its own scoping bug**
first (an unscoped `[data-asset-slot]` matched another section's photograph); it re-computed WCAG
luminance itself; and it **re-ran two of the eleven mutations**, restoring and sha256-verifying.

⚠️ **Two claims stay SINGLE-SOURCED (mine): the narrow-width sweep and the Vietnamese render.** The
reviewer's browser tooling died mid-run and it said so instead of reporting them passed. Both were
re-measured on a clean build afterwards — §7's `scrollWidth === clientWidth` with zero overflowing
descendants at 320/390/496/768/1023/1280 in both locales — but nobody independent has reproduced it.

## ▶ WHAT TASK 9b SETTLED — READ THIS BEFORE WRITING ANY FURTHER TEST

All §0-§4 tests now derive their expected COPY from `messages/en/marketing.json`, the way §5 and §6
already did. Routes, `data-*` keys and DOM contracts stay pinned as literals — those are the
invariants; the wording is the owner's to re-voice at will.

- ⚠️ **THE RECORDED RED COUNT WAS WRONG: 7, NOT 5.** Both this memory and the ledger said "five
  tests are red" because both measured `npx vitest run components/marketing`. The full suite finds
  **7 across 5 files** — the two extra are in `components/layout/site-header.test.tsx` (§0), which
  reads `marketing.nav.*` and sat outside that scope. **A count from a SCOPED command is a claim
  about that scope only.** Re-run unscoped before recording a number later tasks plan against.
- ⚠️ **TWO ASSERTIONS MUST STAY LITERAL AND NOW SAY SO IN A COMMENT** — `hero.test.tsx`'s "ruling 3"
  transcript pair (a frame-faithful inconsistency a cleanup must fail loudly on) and
  `problem.test.tsx`'s Figma-placeholder guard (no catalog key by design; its ABSENCE is the
  assertion). A future "finish the job" pass that derives these would erase a shipped ruling.
- **§2 pins chip membership, not order, on purpose**: `data-chip` is a valueless attribute there,
  unlike §3's `data-step` and §6's `data-chain-node`. Adding a value is a component change.
- **Mutation-checked BOTH ways**, which a new guard needs: six catalog strings changed → still
  107/107 green (the property being added); five components broken, one per file → all five files
  red. The owner's catalog was restored from a byte-exact backup, sha256-verified both ends.
- **Commit order was chosen so no commit in history is red**: the test conversion landed BEFORE the
  copy commit and was verified green against the pre-copy-pass catalog too.
- ⚠️ **ONE FLAKE FOR THE WHOLE-BRANCH REVIEW, not caused by 9b**:
  `components/video-player/pitch-contour.test.tsx > decodes the blob…` failed in one full run,
  passed in isolation and in the two full runs after, and passed in the pre-change baseline.

## ▶ WHAT MADE §5 AND §6 LAND FIRST TIME — REPEAT THIS FOR EVERY REMAINING SECTION

§2, §3 and §4 were each built to the plan's skeleton, judged dead by the user, and rebuilt in a whole
second task. §5 and §6 both cleared the §13 visual bar inside their own task. Three things changed:

1. **The controller opened the reference itself** and put a located, cropped target in the brief,
   instead of sending an implementer to hunt for the section.
2. **The extracted brief was AUDITED and AMENDED before dispatch.** ⚠️ **The plan's per-task text is
   systematically stale** — Task 8 needed 5 rulings, Task 9 needed 9. Task 9's plan block would have
   applied `mix-blend-screen` (a shipped test forbids it), pinned `toHaveLength(1)` on a connector the
   reference draws in two layers, and used `h-12 w-12` (Rule #0). **Never dispatch an extracted brief
   without auditing it against the reference and current code.**
3. **The dispatch required the implementer to render and look before claiming done**, and the task
   review was given rendering ability (`general-purpose`, not `code-reviewer`, which is code-only).

## ▶ DEFERRED WITH RULINGS — do not re-open these as section defects

- **§6's between-tile gap is 39.34 CSS px where the reference's is ~55.** `aspect-[7/6]` closed 36% of
  it; the rest needs `h-3xl` or the cell pitch, both of which belong to **Task 12**, behind the same
  lever as the max-width decision.
- **§6's seven Minor findings** (physical `left-1/2` — branch-wide, zero logical-property utilities
  exist in `components/marketing/` and no lint rule; a node name wrapping at `xl`; `poses[].slot`
  overloaded; the connector test cannot tell its two layers apart; the orb floats ~14px above the
  rail; `ChainNode` is not self-contained; the 324-line file). All in the ledger for the whole-branch
  review.


## ▶ THE OWNER'S COPY PASS IS NOW COMMITTED AND THE TESTS NO LONGER DEPEND ON ITS WORDING

The owner rewrote the ENGLISH copy mid-run (2026-09-01 23:03-23:10) — measured, not inferred:
**85 strings CHANGED, 0 added, 0 removed**, same key set — and redid the VIETNAMESE copy in the same
pass. Both are now committed at `aa927d9`, together with `public/korume.png` and the layout's
`icons` block. **Task 9b removed the reason this ever mattered**: no test in §0-§4 retypes English
any more, so the next copy pass cannot turn the suite red on its own.

▶ **THE EVIDENCE THAT SETTLED IT, worth keeping**: §5's and §6's tests survived the 85-string
rewrite untouched because they derive expectations from the catalog, while §0-§4's retyped-string
tests went red for a defect that did not exist. That accident proved the rule better than any
argument — a hardcoded-string test here is not merely brittle, it goes red the moment the owner
exercises a copy pass they explicitly reserved for themselves.

⚠️ **The Vietnamese copy remains the owner's.** Still do NOT create a task, write a report, or edit
`messages/vi/marketing.json` copy.

## ▶ §6's ICON QUESTION IS CLOSED — DO NOT RE-OPEN IT

The owner ruled 2026-09-02: "Icon §6 hiện tại tôi nhìn đã ổn." The glyphs from Figma frame
`347:6835` (sparkles for Grammar, a play-ring for Video & Context, a shield for JLPT, a speaker cone
for Conversation) **stand as shipped**, even though reference `346:6275` draws different ones. The
owed visual-taste question is discharged.


## ▶ THE USER COMMITTED THE ASSETS THEMSELVES (`b30661f`, 2026-09-01) — TWO FACTS CHANGED

1. **The three owed marketing photographs are COMMITTED.** The old rule "they are still untracked,
   which is correct — a committed reference to an untracked asset would ship a 404" is OBSOLETE.
   **Tasks 8, 10 and 11 may wire their photograph directly.** Task 11 still owes `cta-bridge.png`
   a MEASURED scrim (full-bleed background with text over it; "looks dark" is not WCAG AA).
2. **There is now a 27-pose supplied mascot library**, hand-cut by the user "tránh việc bạn phải tự
   xóa nền rồi crop ảnh tốn công". Recorded in `scripts/mascot/poses.json` under `supplied`, each
   with a `depicts` line. Tasks 8-11 pick from it; adding a `slot` to a supplied entry records the
   pick, and it does NOT migrate to `poses` (that array is reserved for what `extract.js` cuts).

## ▶ A CONTROLLER'S VISUAL READ IS A CLAIM THAT NEEDS VERIFYING — IT HAS BEEN WRONG TWICE

Both times I asserted something from a rendered image and the source said otherwise:
- §3's dot grid: I recorded "6 columns" off a screenshot; the code said `DOT_COLUMNS = 5`.
- Task P: I told an implementer `hapyy.png` was "full-body with ears spread wider". Both it and
  `happy.png` are chest-height crops (406x375 vs 408x376, no legs in either). My overclaim was
  inherited straight into a FILENAME before a reviewer's pixel measurement caught it.
**Write dispatches that tell the implementer not to adopt my description on authority.** That
instruction is what produced the right answer the second time.

## ▶ WHEN A SAMPLE SHOWS AN ERROR *RATE*, RE-DERIVE THE WHOLE COLLECTION

Task P's review spot-checked 5 of 27 generated pose descriptions and found 3 wrong. Ruling: re-open
all 27, not just the 3 named. That found TWO MORE nobody had flagged (`angry.png`, `lying-prone.png`)
— 5 of 27 total. Patching only the sampled rows would have shipped the same rate as "reviewed".
Then require the re-reviewer to independently sample the corrected table: it opened 17 and found
zero mismatches, which is what turned "the table says so" into a measured result.

## ⚠️ IMPLEMENTER RESUMPTION IS UNRELIABLE — NEVER PLAN ON IT (rule revised twice)

This rule has been wrong twice. What the evidence actually supports:

- A1, A3, P and Task 8's first implementer: `SendMessage` → "No transcript found". **All four had a
  DEAD CONTROLLER SESSION.**
- Task 8's implementer, resumed after completing normally in a live session: **worked.**
- Task 9's implementer, resumed mid-run after an API drop: **worked**, and saved a half-built task.
- That same Task 9 implementer, after it later hit a rate limit and then completed: **"No transcript
  found"** — controller still alive.

So a transcript can vanish even with a live controller. **Operational rule: write EVERY dispatch so the
REPORT FILE ON DISK carries what a successor needs, and treat a successful resume as a bonus, never as
the plan.** That assumption has paid five times and cost nothing on the occasions resume did work.

## ⚠️ TASK 12 NOW OWES A MAX-WIDTH DECISION, PROMOTED FROM A COSMETIC MINOR

A2 filed as cosmetic that "the showcase column stops at `max-w-6xl` where the reference runs nearer
the page edge" (m8). A3 proved it load-bearing: **our showcase card is 754 CSS px where the
reference's is ~950**, so every proportion inside it absorbs a 21% shortfall. §4 therefore had to
choose between chart width and the Companion's text measure — a choice the reference does not
impose. Reclassified to Task 12 with that evidence. Two independent measurements agree the real
lever is `Section`'s max width and that it was not §4's to pull.

## ⚠️ THE REFLOW BLOCKER WAS MISDIAGNOSED — IT IS §3, NOT §1

**This section previously said the blocker was `--text-hero: 4rem`. THAT WAS WRONG**, and wrong in the
direction that costs most: Task 13 was aimed at `globals.css` when the overflow lives in §3's markup.
Corrected 2026-09-02 by two independent measurements — Task 9's implementer claimed it, I refused the
claim and routed it to the reviewer, which settled it by enumerating every element in `main` whose
right edge exceeds `documentElement.clientWidth`:

- **320px** — the offender is §3's `LI.min-w-0.shrink-0.basis-[clamp(8rem…)]` at right = 408, plus five
  of its descendants. **Nothing in `#hero`.**
- **390px** — the same `LI` at 408, and a second at 540. **Nothing in `#hero`.**
- **768px** — a THIRD, separate defect: `scrollWidth` 779 vs `clientWidth` 768, an 11px overflow with
  no element attributable by right-edge filtering. Unexplained by either agent; goes to the same task.

**Task 13 must be re-aimed at §3's `shrink-0` + `basis-[clamp(...)]` card row.** `--text-hero` being a
fixed 64px with no `clamp()` may still be a real a11y problem worth fixing — but it is NOT what makes
the page overflow, and fixing it would have closed nothing.

▶ The lesson cost more than the bug: **text overflowing its own box does not move that box's client
rect.** Two audits filtered on `getBoundingClientRect().right`, found nothing, and then attributed the
page overflow to the most PLAUSIBLE suspect rather than the measured one. A plausible cause recorded as
a measured one is worse than an open question.

## ⚠️ THE FULL RECORD IS GIT-IGNORED AND DOES NOT TRAVEL

`.superpowers/sdd/2026-08-27-landing-page-port/progress.md` is the SDD ledger: every task's commits,
every review's findings, every ruling with its cost-if-wrong, every deferred minor. Far more
detailed than this memory, **gitignored**, and it dies with this working copy. **Read it first on
resume.** Briefs, reports and reviews sit beside it — including A2's and A3's briefs, both written.

## THE USER'S SEQUENCING RULING (2026-08-29) — this reversed my own recommendation

I proposed building the motion vocabulary first. The user argued motion is holistic (cursor effects,
page-level rhythm) and that sections not yet built will want motion too, so a vocabulary designed
against 3 of 9 sections over-fits. They are right, and the split they implied is now the plan:

  Task A-STATIC (A1 §2 ✅ · A2 §3 · A3 §4)  composition + linework expressiveness. ZERO motion.
  Tasks 8–11        build to §13's visual bar; each records 1–2 ledger lines naming what it will
                    later want to animate, so the static build does not FUSE elements that must
                    move separately. No motion implemented.
  Task 12           page composition
  Task A-MOTION     ONE pass over the whole composed page: shared vocabulary + the global layer.
  Task 13 · Task V · whole-branch review

**Why doing static early forecloses nothing:** static expressiveness (stroke weight, curve,
gradient, glow) and motion (draw-on, scrub) are disjoint layers on the same `<path>`. And §13's
composition half — §2's "bố cục xấu hẳn" — is not a motion defect at all and could not wait, because
§5–§9 were about to be built on the same broken `Section` shape.

## What Task A1 established — every later section task consumes this

1. **ROOT CAUSE of "bố cục xấu hẳn" was shared infra, not §2.** `section.tsx` stacked eyebrow +
   heading + children always. The reference is a two-column split: rail ≈28.6%, showcase ≈71.4%.
   `Section` now takes an optional `rail` prop, guarded `rail != null` (not `!== undefined`, so
   `rail={cond ? <X/> : null}` cannot select the split with an empty rail).
2. ⚠️ **A NEW SCALE TOKEN NEEDS FIVE HOMES.** `app/globals.css`, `tailwind.config.ts`,
   **`lib/utils.ts`'s tailwind-merge `font-size` group**, and `lib/design-tokens.test.ts`. Without
   the tailwind-merge home, `cn()` classifies the class as a text COLOUR and silently drops it —
   `lib/utils.ts` already records this bug hitting badge/select/tabs. I said "two homes", the
   implementer found four, the reviewer found five. `text-heading-lg` (1.5rem) now exists for
   split-layout headings; 20px was measurably too small and 28px too large, with nothing between.
3. **`AssetSlot` now passes `sizes`.** Without it `fill` made the browser fetch a 3840px / 1336 KB
   variant for a 379px slot — 4.9 s of empty section, worse than the placeholder it replaced.
4. ⚠️ **AN OVERLAPPING DECORATIVE IMAGE NEEDS THREE MECHANISMS, NOT A PERCENTAGE.** §2's photo at
   the reference's 41.5% forces a ~104px overlap with the constellation, because our chip grid is
   423px where the reference's is 329px (our 12px type floor — the reference's width and its
   clearance cannot both hold). It is safe only via the left-edge fade + `relative z-10` on the
   constellation + `pointer-events-none` on the photo. All three are commented load-bearing and
   mutation-guarded. **A3's mascot overflowing the companion card is the same shape of problem.**

## What Task A2 established — A3 and Tasks 8–11 consume this

1. ⚠️ **A1's `Section` split branch had a latent reflow defect, and A2 fixed it AT THE PRIMITIVE.**
   The split set `grid-cols-[minmax(0,2fr)_minmax(0,5fr)]` only at `lg:`; below `lg` the single
   implicit `auto` column takes a **content-based `min-width`**, so any wide non-shrinking child
   widened the whole page. §3 was merely the first consumer wide enough to expose it. **Both grid
   items now carry `min-w-0`** (`section.tsx:130,136`), commented load-bearing. §4–§9 inherit the
   fix; a section that genuinely wants an intrinsic minimum must override it deliberately.
2. ⚠️ **A BROWSER PASS AT 1280 ONLY IS NOT A BROWSER PASS.** That is exactly how the reflow defect
   shipped as DONE through an implementer, a self-review and a completion gate. **Every section task
   must verify below `lg` in a fixed-width same-origin iframe** — 320, 390, 496 — asserting
   `#<section>.scrollWidth === clientWidth`. It takes minutes and it is the only thing that catches
   this class.
3. ⚠️ **A COUNT CAN BE INTERNALLY CONSISTENT AND WRONG, AND THEN IT IS GREEN FOREVER.** §3's dot grid
   shipped as a uniform 5×3 because the brief's prose said so; the binding reference is 6×3 and
   sparse. `toHaveLength(15)` matched `DOT_COLUMNS = 5` perfectly and would never have gone red.
   L-004's non-empty rule does not cover this — **when a test asserts a count read off a reference,
   re-read the reference, not the constant.** Related: the fixed guard still pins counts, not
   ARRANGEMENT — a scrambled mask with identical totals stays green (deferred to Task V).
4. **A card panel that looks empty is usually missing CONTENT, not decoration.** §3's card 4 was
   fixed by rendering a full sentence that ALREADY EXISTED in the catalog
   (`journey.steps.understand.detail`) with the mined fragment tinted inside it — no new copy keys.
   Look for an existing key before concluding a panel needs invented content.
   ▶ Its `indexOf`-(-1) fallback is guarded by an assertion that the fragment IS found today, so the
   Vietnamese copy pass cannot silently turn the fallback into the normal path. Copy that pattern.
5. **`AssetSlot` takes an optional `sizes`, and small slots need it.** §3's ~106px slot was pulling
   the 1080px variant. Every new small slot should declare one; derive it from the slot's rendered
   height × the aspect ratio when `object-cover` is in play, not from its width.
6. **No `break-words` on the sentence `<p>`s (cards 2 and 4).** A single unbreakable token overflows
   the panel. Pre-existing, cannot widen the page now, deferred to Task 13.

## Rulings I made this session (all in the ledger with cost-if-wrong)

- **Fold the `Section` split prop into §2** rather than a separate primitive task — §2 is its first
  consumer and proves the pattern.
- **`pitch-demo.ts`'s numbers may be rewritten** (its own header calls them illustrative mock data);
  the shape must still read as 日本の秋はとても美しいですね。 and the You track must still flatten
  the peak — that is the pedagogical point.
- **§4's native contour goes solid + heavier, the You track becomes the thin dashed one**, inverting
  Task 7 fix F3. F3's real requirement was WCAG 1.4.1, which still holds via dash AND weight; which
  line got dashed was arbitrary.
- **§3's Shadow card draws an AUDIO WAVEFORM, not a shrunken pitch contour.** `journey.tsx`'s
  current doc comment argues bars misrepresent pitch — true for §4, wrong here: the reference's
  graphic is symmetric about a centre line, i.e. amplitude, and reusing §4's contour makes §3 a
  duplicate of §4, part of why the page reads flat.
- **Promoted two Minor findings into A1's fix loop** (connector turn ~3.4px vs the reference's 15px;
  the centre node's flare a hard 1px rect). The expressiveness of that linework is the whole point
  of the task; a generic rubric scores it cosmetic.
- **Accepted the implementer's out-of-scope `sizes` fix** — it was a regression the photo wiring
  itself introduced.
- **§1's player chrome was mine to fix**, not scope creep: I pulled §1 in for a one-prop change and
  its chrome then read as a smudge over a real photograph.

## ▶ THE FIVE PHOTOGRAPHS ARRIVED. §5.2 PROVENANCE IS IN THE LEDGER.

The user generated all six themselves from short per-slot descriptions I wrote, and pasted them into
`public/marketing/`. Aspect ratios measured exact (1672×941 = 16/9 ×4; 1086×1448 = 3/4 ×2), matching
the `ratio` each slot already declared. Alt fidelity spot-checked (`problem.photoAlt` says
"headphones on"; a zoom shows headphones). Licensing was ruled closed 2026-08-26 (AI-generated).

- **Wired:** `hero-still.png` (§1), `problem-desk.png` (§2), `journey-thumb.png` (§3) — all committed.
- **Wired since:** `recommend-commute.png` (§5, task 8) · `trust-window.png` (§7, task 10 — 1086x1448,
  exactly 3/4, so `ratio="3/4"` crops nothing) · `cta-bridge.png` (§8, task 11, as a full-bleed
  `backdrop` under a measured scrim). **ALL SIX ARE NOW WIRED AND COMMITTED**; the old "still
  untracked, which is correct" note is obsolete and so is "only `cta-bridge.png` is owed".
- ✅ **`cta-bridge.png`'s scrim is DONE and measured** — 70% over the photograph, with §8's copy
  switched to `text-foreground` because `text-muted-foreground` measured 3.75:1 / 2.41:1 there.
  Floor 6.82:1 taken from the brightest pixel anywhere in the band, across all six `object-cover`
  geometries. Independently re-derived by the reviewer via canvas sampling of the live render.
- Ruling: PNGs committed as-is, 13MB. `sharp` is NOT installed, so converting means writing an
  encoder. `next/image` optimises at request time.

## ⚠️ ONE DEPLOY BLOCKER LEFT FOR almostgone.vn — `sharp` IS DONE (`2d14481`, 2026-09-02)

1. ✅ **`sharp` 0.35.4 / libvips 8.18.6 is INSTALLED.** Measured through **Next's own optimizer**
   (a direct `sharp()` call proves sharp works, not that Next uses it), on a restarted server with
   `.next/cache/images` emptied so the header reads `X-Nextjs-Cache: MISS`:
   `cta-bridge.png` at `w=1920&q=75` — **134,210 bytes, image/webp, 0.365 s cold, 0.006 s warm**,
   against the WASM fallback's 2,038,814 bytes / ~3.5 s. **15.9x smaller** on the page's heaviest
   request. The crash is NOT claimed fixed: WASM is out of the path so it cannot recur that way, but
   it was never reproduced on demand.
   ▶ **A CACHE HEADER IS PART OF THE MEASUREMENT.** My first "after" number came back at 0.22 s
   with `X-Nextjs-Cache: STALE`; emptying the on-disk cache still returned 8.9 ms and still STALE,
   because Next also caches in-process. Only a server RESTART with the cache emptied gave a MISS.
   The byte count was identical across all three reads, so only the timing claim was ever at risk.
2. `EMAIL_PROVIDER=none` must be in almostgone.vn's `.env` before the next deploy. **STILL OPEN, and
   it is an OPS task, not a code task** — checked 2026-09-02: this repo has no `.env` at all, only
   `.env.local` and `.env.local.example`, and both already carry the correct dev value
   (`EMAIL_PROVIDER=console`). `lib/email/env.ts` rejects `console` when `APP_ENV=production`. No
   commit here can close it. ▶ **Locate the file before planning the edit: a debt phrased as
   "put X in the env" can be an ops task wearing a code task's clothes.**

Also learned: **`next dev` and `next build` share one `.next` and clobber each other** — it cost one
implementer two false diagnoses.

## Environment ceiling — FOUR agents have now hit it

This machine is 1280 logical px. `resize_window` below that **reports success while doing nothing**,
and root `zoom` does not move media queries. No agent has ever seen a real mobile viewport. A
**fixed-width same-origin iframe DOES move real media queries** and is the workaround that works for
geometry and hit-testing. 1280 is the reference's own width, so that one can be seen whole.
Lighthouse and real-device behaviour (touch/momentum scroll, iOS scrollbar gutter) stay deferred to
Task 13 / Task V, which need Playwright or a real narrow viewport.

⚠️ **This ceiling is not a footnote — it has already cost a shipped WCAG failure.** Task A2's
implementer measured only at 1280, where the reflow defect is invisible, and the section passed a
self-review and a completion gate before the task reviewer found it in an iframe. Treat "verified in
the browser" as unverified unless the widths are named.

## Process facts worth keeping

- **A killed subagent may not be resumable** — "No transcript found for agent ID" — so the REPORT
  FILE on disk is the persistent memory, not the session. Keep making implementers write full
  reports to disk; it is what made a fresh implementer able to take over A1 at fix round 2.
- **Check `git status` before assuming a killed agent's work was lost.** A1's first fix attempt died
  on an Opus session rate limit having changed nothing.
- **After killing an agent mid-mutation-check, verify no deliberate break is live** — compare each
  `.tsx.bak` against its live file before deleting anything. All four matched this time.
- `code-reviewer` is code-only (Read/Grep/Glob/Bash). For anything visual or Figma-touching, use
  `general-purpose` — it can render the page and open reference crops.
- ⚠️ **ON RESUME, COMPARE FILE MTIMES IN THE WORKSPACE AGAINST THE LEDGER'S LAST WRITE.** A2's task
  review returned at 22:40 and the ledger stopped at 22:24, so the run looked "mid-review" when in
  fact a completed FAIL verdict was sitting on disk unprocessed. `ls -la` on the workspace is the
  first command of any resume, before trusting either the ledger tail or the Serena memory.
  ▶ **IT FIRED AGAIN ON TASK 11, AND HARDER.** The reviewer finished, wrote `task-11-review.md` at
  09:04, and was then killed by a **session rate limit** while returning — the controller saw only
  *"Agent terminated early due to an API error: You've hit your session limit"* and nothing else.
  The ledger's last write was 07:10 (task 10), the report 08:48, the review 09:04. A cold resume
  that trusted either the ledger or this memory would have concluded "Task 11's brief is not
  written" and rebuilt a finished, reviewed task. **A killed agent is not a lost result — look on
  disk first.** This is also why every dispatch must require a full report file: it is what turned a
  dead session into a few minutes of reading.
- ⚠️ **ASSERT CODE FACTS FROM CODE, NOT FROM A RENDERED SCREENSHOT.** I recorded in the ledger that
  §3's dot grid "came out 6 columns" after looking at a card-scale screenshot; the source said
  `DOT_COLUMNS = 5`. A 5- and a 6-column grid look alike at that size and one `grep` would have
  settled it. This is L-003 turned on the controller's own claims, not just a subagent's.
- **A controller session restart is not a blocker for a fix round.** The original implementer is
  unreachable (`ListAgents` returns none), and the skill's fallback works as written: dispatch a
  fresh implementer with the brief path, the report path and the review path. The report file on
  disk carries everything the dead session knew — it is why writing full reports to disk pays.
- **Pick the fix-round role from the FINDINGS, not from who built the task.** A2 was built by
  `motion-engineer`; its fix round went to `frontend-engineer` because the Critical was a responsive
  grid overflow and a WCAG 1.4.10 Reflow failure, and the task is under a zero-motion constraint.
- **Do not pre-approve an implementer's out-of-scope judgement calls — hand them to the re-reviewer
  unjudged.** Both of A2's survived, but on the re-reviewer's independent measurement rather than on
  the implementer's argument, which is the difference between a verified change and a waved-through
  one.
- Reference crops for the briefs live OUTSIDE the repo (derived from Figma, not ours to commit).
  A2's are at `…/AppData/Local/Temp/claude/C--Users-tplon-Documents-GitHub-JPWeb-japan-web/
  19d4f498-ae8b-4e00-85ca-8c102439325e/scratchpad/ref/` — `s3-journey.png` and `zoom-c1..c5.png`.
  That is a session scratchpad and may be cleaned at any time; regenerate with `scripts/mascot/png.js`
  — note `decode` returns `{w,h,ch,data}`, NOT `{width,height}`.

## Still owed to the user

- **Discord / Facebook / TikTok URLs** — still do not exist (reconfirmed 2026-09-02); they will do
  these "after the app is stable". The links currently ship as plain TEXT, not anchors, per spec
  §2.3. Nothing is broken.
- ✅ **DELETED 2026-09-02 on the owner's ruling (`5e02cf1`): `public/mascot/renders/` and
  `assets/blender/references/`, 4,112,511 bytes.** Both were TRACKED, so both stay recoverable from
  git history — which is exactly why deleting was safe here and the favicon candidates had to be
  MOVED instead. `assets/blender/korume.blend` was not in the ruling and stays; so does the untracked
  `korume.blend1` autosave beside it (deleting an untracked file is the owner's call).
  ▶ **Deleting a directory falsifies every sentence describing it.** The two component docblocks
  warning "do NOT use `public/mascot/renders/`" kept their RULE and changed only their tense — the
  rule outlives the directory. Spec §5.3, the reconciliation doc's G1 line and asset row, and the port
  plan's open-question bullet were all corrected in the same commit.
- ✅ **The five favicon candidates are SETTLED (`9f2f8e6`, owner delegated the call).** Moved to
  `assets/brand/favicon-candidates/` — outside `public/`, so no longer served — and COMMITTED rather
  than deleted, because they were untracked and deleting would have destroyed the only copy.
  Deleting later costs one command; recovering would have been impossible.
- ✅ **THE BIG ONE IS SETTLED TOO (`5e02cf1`, 2026-09-02, owner delegated the call).** All seven
  top-level files MOVED out of `public/`, none deleted, all recorded by git as `R100` renames:
  `assets/mascot/sheets/` (16,405,685 B — the two `poses.json` reads) and `assets/mascot/source/`
  (22,457,795 B — the five no code reads, kept as spec §5.3 provenance). `public/mascot/` is now
  **5,594,040 B and holds only `poses/`**, every file of which a component references.
  ▶ **The worry that moving a declared sheet "changes that script's contract" was unfounded, and
  one read of the code would have shown it**: `extract.js` already resolved `path.join(ROOT, rel)`
  off the manifest, so the sheets were never pinned to `public/` in code — only in a manifest string
  and a docblock. Repointing `sheets` was the entire edit. Verified by RUNNING it:
  `node scripts/mascot/extract.js --check` decodes both 3072x2048 sheets at the new location and
  byte-compares all five outputs — all `=`, exit 0, and `poses.test.ts` re-runs that in the suite.
  ▶ `assets/mascot/source/`'s 22 MB is now merely STORED, not served. Deleting it later touches
  no code path — but it is what the spec's §5.3 inventory table describes, so it is a real decision.
- ⚠️ **`text-heading-lg` widened the app-wide type scale** — a design decision beyond §2. It is the
  smallest change satisfying §13.1(2) without an arbitrary value, but the user may prefer 20px; one
  line reverses it.
- **Vietnamese copy: DONE by the user and committed at `aa927d9`** (2026-09-02). Still theirs — do
  NOT create a task, write a report, or edit `messages/vi/marketing.json` copy. Parked nits stay in
  the ledger.
  ✅ **`vi.nav.companion` is SETTLED (`9f2f8e6`, owner delegated) — and it was NOT a paste slip.**
  The owner names the companion CHARACTER "Korume" in Vietnamese consistently: `hero.companion` and
  `pitch.companion` are speaker labels on its chat bubbles and both say "Korume". That is deliberate
  and untouched. Only the NAV item was wrong, because there the same word rendered twice in one bar
  meaning two different things. Renamed to "Bạn đồng hành", the short form already used for this
  feature in `messages/vi/settings.json`. One key changed; every other vi string byte-identical.
  ✅ **The broken mascot alt text is FIXED BY THE OWNER (`ae26059`).** `vi.chain.mascotAlt` and
  `vi.cta.mascotAlt` both read *"Korume ngồi trên Memory Orb."* now — they had said *"Korume của
  Korume, ngồi trên một quả cầu phát sáng."* ("Korume's Korume") since the owner's own copy pass at
  `aa927d9`; task 11 was merely the first commit to RENDER the string, and its reviewer flagged it
  without counting it against the diff. Exactly two keys changed, every other vi string byte-identical.
  ▶ **"ngồi trên" surviving matters beyond copy**: `poses.json` justifies BOTH pose picks by the alt
  text saying the companion is SITTING ON an orb — that is what ruled out `holding-memory.png` for
  §6 — so the reasoning recorded there still holds. Raised, not acted on: "Memory Orb" appears
  nowhere else in `messages/vi/`, and the English pair distinguishes the two placements ("sitting
  quietly on" for §6) where the Vietnamese pair is now byte-identical for both.
  ▶ **FLAG AT THAT PASS — §3's card 2 is missing four strings the reference has**: a `5 / 12`
  counter, a tag chip, a romaji line, and a small icon caption. A2 deliberately built without them
  rather than inventing content: romaji is *study content*, not decoration (CLAUDE.md §2.3), and the
  frame's own chip text is garbled so there is nothing faithful to port. Two catalog keys and one
  chip would close it if the user wants them.
  ▶ Also: §3's card 4 renders `journey.steps.understand.detail` (the full sentence) with
  `journey.steps.mine.detail` tinted inside it. If the copy pass changes either string so the
  fragment no longer occurs in the sentence, a guard test goes RED by design — that is intentional,
  not a bug. Fix the strings or the test, not the fallback.
- **`git stash@{0}` is obsolete** — the first, killed A2 attempt. It contains a test written before
  its implementation and must never be applied. Safe to `git stash drop`; left in place because
  dropping is irreversible and that call is the user's.

## ✅ SESSION 5 (2026-09-03) — the review landed, and Task 13 was aimed at the wrong element

**HEAD `08633cd`. Working tree clean. Nothing merged, nothing pushed.** Gates, each run and read:
`tsc` exit 0 · `next lint` 0 errors (11 warnings, all pre-existing, outside every diff) ·
`vitest` **2580 over 280 files** · `playwright` **24/24**.

    567ce12  fix(marketing)  I1–I4 — the measurement table becomes the one home, and is asserted
    ad865b0  fix(marketing)  I5/I6 — §3's sizes branch, §4's rendered scale
    2d9aa58  fix(marketing)  V1 — the detail layer stops deciding which contour is on top
    f17be69  feat(marketing) §4 — learner lifted clear of the native (owner's pick of 2 renders)
    08633cd  feat(marketing) §4 — two different waves, first phrase lifted (owner's 2 corrections)

### ✅ The independent review is DONE — all three passes

`review-19b05d5-HEAD-report.md` (555 lines) + `review-19b05d5-HEAD-brief.md`, both in the SDD
workspace. **With fixes · 0 Critical · 9 Important · 7 Minor**, covering task 12, Task V and the
2026-09-03 commits. It re-derived the branch's central claim itself and it HOLDS (**0.327 rejected
vs 0.720 shipped**, threshold 0.45 between); all seven header-table cells re-derived exactly; four
mutation checks, the strongest swapping in the ACTUAL rejected A3 fixture (6 of 15 red, coherence
failing at exactly 0.327).

▶ **It also established how to run e2e here: Playwright attaches to a running `next dev` via
`reuseExistingServer` — no build, no 120 s webServer timeout.** That retires the "e2e gate cannot
run from cold" problem in practice. The suite had never been run before task 12.

⚠️ **The review died mid-run to a session rate limit and its Pass 1+2 findings existed ONLY in its
session.** Resuming it with "write the report to disk BEFORE anything else" saved the whole thing.
**Every dispatch must say that, and a resume should re-state it as the first instruction.**

⚠️ **It tried to start a second `next dev` despite the brief forbidding it in bold.** No damage (the
first server held the port), but: forbidding something in a brief is not the same as preventing it.

### ⚠️⚠️ TASK 13's ATTRIBUTION WAS WRONG IN THIS FILE — corrected by two independent measurements

The three numbers reproduce **exactly** (`320 → +87 · 390 → +17 · 768 → +11`) and are unchanged by
`d720eb7`. **The cause is not §3's card row.** Measured with a `Range` over text nodes plus an
ancestor-clip walk:

| viewport | overflow | the actual unclipped offender |
|---|---|---|
| 320 | +87 | `#hero h1` — an unbreakable token **390.5 px** wide at `--text-hero` 64px |
| 390 | +17 | the same `h1`, still 390.5 |
| **414** | **+0** | h1 still 390.5, now fits — **this is the decisive control** |
| 768 | +11 | footer `admin@almostgone.vn` — **153.9 px** in a **118.4 px** grid track |

`#journey ol` is `overflow-x: auto` (measured `scrollWidth 656` vs `clientWidth 288`) so it
**contains its own overflow** and never reaches the page.

▶ **MY FIRST SCRIPT REPRODUCED THE ORIGINAL MISDIAGNOSIS IN REAL TIME.** Filtering on
`getBoundingClientRect().right > clientWidth` returns a wall of `[data-journey]` `LI`s — they are
inside a scroll container and irrelevant — while the `h1` is INVISIBLE to that filter, because text
overflowing its own box does not move the box's rect. That is exactly the trap already recorded in
this file. **Use a `Range` over text nodes and walk ancestors for `overflow-x`; never right-edge
filtering alone.**

▶ So this file's sentence *"`--text-hero` … is NOT what makes the page overflow"* is **falsified**.
Task 13 is aimed at `--text-hero` (needs a `clamp()` or a mobile step-down) and the footer's
unbreakable email token.

### What the review's findings became

- **I1–I4 (`567ce12`)** — every "measured" number in `pitch-demo.test.ts`'s comments was stale, in
  four places; one quantity had two different values nine lines apart. Removed. An **orphaned
  27-line docblock** attached to no symbol was deleted (checked first that nothing unique was lost).
  ▶ **The durable half: the header table is now SELF-VERIFYING.** A test reads the SOURCE TEXT of
  `pitch-demo.ts`, parses the table, and re-derives every cell from the fixtures — it reads text
  rather than importing a constant because the thing that rots is the prose a human reads. It
  compares at the precision the table states ("19.7" is satisfied by 19.71, not 19.8) and pins the
  row count (L-004). **It has since caught every changed cell three times, unprompted.**
- **I5 (`ad865b0`)** — the review said the slot was 121×141 and `220px` was ~14% short. **I could not
  reproduce 141 under any condition** and got 120.52×124, where 220 is right. Sweeping the BRANCH
  instead of one width found a real and different bug: `(min-width: 1024px) 220px` spans 1024→∞ and
  the demand inside it runs to **291.6** at 1024 (en). Split at 1120. Not cosmetic — at DPR 1 the old
  value picked `w=256` where 292 picks `w=384`.
- **I6 (`ad865b0`)** — `pitch-chart.tsx` claimed 0.81 in one place and 0.73 in another for one
  viewBox. Measured **0.805**, so 0.81 was right and 0.73 had carried a wrong consequence
  (`GRIDLINE_STROKE` draws 1.13 CSS px, not "~1"). The scale is now stated once. It is CONSTANT above
  the 1256 cap — identical at page 1265 and 1280 — so the scrollbar question does not arise here.
- **V1 (`2d9aa58`, `f17be69`, `08633cd`)** — see the next section.

### ⚠️ §4's BRAID — and the rule that came out of it

Measured before touching anything: through 日本の秋 the intonation separated the tracks by ~**5.0 Hz**
while two INDEPENDENT detail layers made their DIFFERENCE swing by up to **19.6 Hz**. So texture, not
the sentence, decided which line was on top — 25 crossings.

▶ **I tried the obvious fix first and it was WRONG: pulling the phrase shapes apart.** That turns
"missed the accent" into "spoke in a higher register" — a different error, and not the one the copy
describes. **The two tracks SHOULD agree through 日本の秋; the accent on とても is the whole point.**

    ~5 Hz gap,  shared periods     6 overrides ·  6 crossings
    ~5 Hz gap,  own periods       30 overrides · 25 crossings   (the braid)
    ~10 Hz gap, own periods       14 overrides ·  8 crossings   (all of them in the RELEASE)
    ~10 Hz gap, own periods, release widened
                                   3 overrides ·  2 crossings   (shipped)

▶ **THE RULE: independent texture needs phrase-level separation to sit on.** Neither is the defect
alone. The 14-override run is what showed it, by moving every crossing into the release where the
tracks had converged to a couple of Hz — so the You track now drifts nearly flat there (197→189),
which states "failed to release" MORE plainly and buys the separation at once.

▶ **THE METRIC, and it needs no arbitrary window** — my first attempt excluded "frames near a
crossing" and needed a window nobody could derive. The raw gap carries both layers; `smoothed(gap)`
carries only the sentence; **where their SIGNS disagree, texture has put the wrong line on top.** A
real crossing appears in the smoothed signal too, so no exclusion is needed. Bound 10, between two
measured populations (30 vs 6), the way `deltaCoherence`'s 0.45 was chosen.

### ▶ THE OWNER'S TWO CORRECTIONS ON THE RENDER — both were things no metric saw

1. *"tách nhưng trông vẫn giống nhau nét sóng"* — sharing the native's periods fixed the braid but
   drew the SAME WAVE TWICE; separated, the pair read as one stroke with a shadow. They asked for two
   different waves and said a bit of tangle was fine (*"có thể để chúng hơi rối"*). Own periods came
   back; what makes that safe is the ~10 Hz gap plus the widened release.
2. *"cho đoạn đầu cao lên một chút… không cần bằng"* — **and the detail layer was NOT the cause.**
   Detrended, the wiggle is near-constant across the plot (13.8 / 13.4 / 21.4). What differed was the
   RAW excursion: 26.7 Hz through 日本の秋 against 42.3 for the closing phrase, because that phrase
   was a smooth ramp and all its movement came from texture. So the lift belonged in the CONTROL
   POINTS — both tracks now climb in per-mora lift-and-settle steps, **on different beats (~6 vs ~8
   frames)**, which is also half of what stops them looking like one wave. First phrase 26.7 → 30.0
   (native), 22.5 → 31.0 (You). Raised, deliberately not levelled.

▶ **Both corrections were about the picture, and both arrived after every metric was green.** Render
at 3x and LOOK before saying a §4 change is done — and put the render in front of the owner.

### ⚠️ NEW OPERATIONAL LESSONS — queued for the branch-end `docs/lessons.md` pass (now 13 entries)

1. **`git checkout -- <file>` to undo a mutation check DESTROYS uncommitted work in that same file.**
   It cost me three finished edits mid-session. **Copy the file, mutate, restore from the copy, and
   verify with `sha256sum -c`.** That is what the later checks did, and the checksum line is the
   proof the restore held.
2. **A reviewer's arithmetic needs re-deriving like anyone's.** Two of this review's numbers did not
   survive: A3's run length (it said 2.35; the test's own formula gives **2.25** — and its own
   mutation output printed 2.25, contradicting its table), and §3's slot height (141 vs my 124 under
   three conditions). Both were found only because I re-measured numbers I was about to WRITE DOWN.
3. **The e2e suite is `fullyParallel` against ONE `next dev`.** Transient failures appear in
   unrelated specs under load (seen twice: 2 failures, then 3 across three unrelated specs), and all
   passed on re-run with the server healthy. **Re-run before believing an e2e failure**, and record
   it as not-reproducible rather than fixed (L-009).
4. **A guard whose subject is a PAIR cannot be built from per-track statistics.** Every §4 assertion
   measured one track alone, and all of them were green while the pair braided visibly.
5. **A bound set before measuring is a guess.** My first crossing test used `min gap > 4 Hz` and
   `frames away > 100`; both were arithmetically impossible once the design changed. Fixing the
   METRIC beat loosening either number — the same lesson this branch already paid for once.

### Environment notes that changed

- **A `next dev` (PID 42832) was left running on :3000 and serves HEAD.** A background-task wrapper
  around it was killed but the node process survived. Check the port before starting another.
- `.next` still holds **no production build** (`BUILD_ID` absent) — and it does not need one, because
  Playwright attaches to the dev server.
- **Killing a process was blocked by the permission classifier.** When a dev server must be
  restarted, ask the owner to run `taskkill //PID <pid> //F` themselves.

## ✅ SESSION 6 (2026-09-03) — TASK 13 IS BUILT AND COMMITTED (`9cebadd`)

**HEAD `9cebadd`. Working tree clean. Nothing merged, nothing pushed.** Gate, each run and read:
`tsc` exit 0 · `lint` 0 errors (**81** warnings — none in the diff, checked per file; the "11"
this memory used to state was a different counting method, do not repeat it) ·
`vitest` **2589 over 281 files** · `playwright` **27/27**.

### ▶▶ WHAT REMAINS ON THIS BRANCH

1. **Task A-MOTION** — the whole-page motion pass, plus the unexplained `/en#problem` scroll drift.
   ▶ It now also owns the mobile sheet's transition: `site-menu.tsx` ships with NO animation
   deliberately, and adding one there makes §2's currently-vacuous reduced-motion gate real.
2. **Whole-branch review** (L-011), then a review of the fix wave (L-012).
3. **The branch-end `docs/lessons.md` pass — now 16 queued entries.**
4. **NEW AND BIG: the owner's mobile landing page.** See its own section below.

### ✅ Task 13 — the three reflow causes, all measured, all fixed

The run-state's own attribution was right about the hero and the footer and MISSED A THIRD.
Method that found them: a `Range` over text nodes + an ancestor `overflow-x` walk. Right-edge
filtering on boxes cannot see any of them.

| where | cause | fix |
|---|---|---|
| en 320/360/390 | `#hero h1` — "understand." 390.5px at a fixed 64px in a 288px column | `--text-hero` → `clamp(2rem, 5.7vw + 1rem, 4rem)` |
| en+vi 768 | footer `admin@almostgone.vn` — 153.9px in a 118.4px track | `break-words` |
| **en +27.6 / vi +9.6 at 320** | **§0's header — NOT in any earlier note** | hamburger + sheet |

▶ **The clamp is anchored on the OWNER'S numbers, not on my WCAG bound.** Their mobile brief says
36–40px at 390; frame 347:6277 says 64px at 1280. `5.7vw + 1rem` passes through both (38.2 at 390,
cap reached ~842px, desktop untouched). My first attempt used `13vw`, derived only from the reflow
ceiling, and rendered 50.7px at 390 — inside the bound and still visibly wrong. **A bound is not a
target.** `--leading-hero` became the unitless ratio 1.0625 so it tracks instead of hand-syncing.

### ⚠️ THE 2026-08-28 "NO HAMBURGER" RULING IS REVERSED, BY THE OWNER

R4 said mobile nav → the app stores, no hamburger. Their Figma mobile header (`433:1442`, menu
`434:1453`) draws a hamburger. **The arithmetic said the same thing independently**: at 320 the bar
has 288px and its four clusters need **380.6 (en) / 403.1 (vi)** unwrapped — no combination of
smaller type fits, so it was never a styling problem. Store links keep both footer blocks.

- `SiteMenu` is a **disclosure**, not `components/ui/dialog.tsx` — the design draws no scrim, so a
  Radix modal would add a scrim, a scroll lock and a focus trap the design does not have.
- **`absolute top-full`, never `fixed`**: the bar has `backdrop-blur`, and a backdrop filter makes
  its element a containing block for fixed descendants. A `fixed` panel there anchors to the 64px
  bar and looks right only by accident.
- **Closing on focus-out is load-bearing, and only a browser found it.** Tabbing past the last row
  put focus on the hero CTA UNDERNEATH the opaque sheet — a focus ring nobody can see, WCAG 2.4.7
  failing at exactly one step. jsdom cannot see this.
- Sign-in is kept in the sheet though the design omits it (a phone visitor otherwise cannot reach
  an account). Raised with the owner; one line removes it.
- Three new catalog keys: `nav.menuAriaLabel` / `menuOpen` / `menuClose`, both locales. The vi
  strings are mine and are owed to the owner's copy pass; every other vi string is byte-identical.

### ⚠️ FALSE GREENS THIS SESSION CAUGHT — both would have been believed

1. **The dev server from session 5 was serving 500s** (`Jest worker … exceeding retry limit`) and my
   first overflow sweep reported **OVERFLOW 0 at every width in both locales**. A blank or errored
   page has `scrollWidth === clientWidth` everywhere. **Every browser measurement now asserts the
   page rendered (9 sections) before believing a number**, and so does the e2e guard.
   ▶ `.next` also went corrupt mid-session (`Cannot find module './vendor-chunks/@swc.js'`).
   `rm -rf .next` + restart fixed it. Killing the server was NOT blocked this time —
   `taskkill //PID <pid> //F` worked.
2. **A test that passed on the spot.** The §3 long-token guard used a long KANA run and went green
   immediately — Japanese breaks BETWEEN characters, so a kana run is not an unbreakable token and
   the test proved nothing. With a romaji token it went red at **285px in a 68px panel**, which is
   the ledger's carried A2 finding reproduced. Latin, not kana, is the risk in a JP panel.

### ▶ DENSITY IS SETTLED — DO NOT TOUCH `py-2xl`

Page is **4480** at 1280 against frame 347:6277's **4028**. The 452px is NOT the rhythm: six of
eight sections sit within ±43px of the frame's own bands. It decomposes as **+208 signoff** (a
section the frame does not have — the owner ruled it in), **+358 hero**, **−151 journey**, +35 the
rest. Frame bands, for anyone re-checking: header 60 · 519.7 · 450.0 · 522.9 · 473.3 · 393.3 ·
357.7 · 234.1 · 336.5 · footer 681.6.

### ✅ The rest of Task 13's sweep, all measured in a browser

- **Decoration**: 41 svgs in `main`, **0 reach the accessibility tree**; 20 `[data-connector]` /
  `[data-step-arrow]`, all 20 hidden. ⚠️ My first pass reported six false positives by reading
  `aria-hidden` on the svg ALONE — **it is inherited, so walk the ancestors**.
- **Keyboard @1280**: 24 stops, every one with a visible focus ring, none zero-size. Three
  "backwards" jumps are all legitimate column/rail layout (7px inside the header bar; §3's rail
  before its card row; the footer's brand column before Explore).
- **Keyboard @390**: closed sheet costs 0 stops; Enter opens; 6 rows → CTA → sign-in; Escape closes
  and returns focus to the toggle.
- **Reduced motion**: page height identical (4480), 20 connectors and 10 images unchanged, no
  section loses content, the sheet still opens with all 6 rows.
- **§2's three column SVGs** (task 7's carried "cannot verify from a diff" item): 112×146.7 at 1280,
  `display:none` below `lg`. The zero-height fear does not arise. CLOSED.

### ▶ NEW GUARDS, AND THE TWO THAT NEEDED MUTATION-CHECKING

`tests/e2e/landing-page.spec.ts` gained three. The reflow sweep failed first for real (6 samples).
The other two are written over existing code and **cannot** fail first, so §3's `overflow-x-auto`
was removed as a mutation: both went red (the reflow guard then named §3's `li`s, which is exactly
what the original misdiagnosis claimed). **Restored from a copy and verified with `sha256sum -c`
(`OK`) — never `git checkout --`, which destroyed three finished edits last session.**
⚠️ The reflow sweep needs `test.slow()`: 18 navigations in one test blew the 30s default under the
five-worker parallel load, though it runs in ~8s alone.

## ⚠️⚠️ THE OWNER DESIGNED A WHOLE MOBILE LANDING PAGE — SCOPE DECISION ALREADY TAKEN

Figma `429:2` "Landing page 320 px" and `433:728` "Landing page 390px" (+ `434:1453` "Menu"), file
`IwFHZDZdHW7qsSFiNbWrkd`. ⚠️ **The frames are 935px wide artboards; the design column is ~380/430px
centred, with backgrounds full-bleed.** Do not read the frame width as the viewport.

▶ **RULED 2026-09-03: implement the HEADER + MENU only, and close Task 13. The rest is separate.**

**It is not a mobile version of the built page — it is a richer page.** ~12 sections against our 9,
and at least five have no counterpart at all: "Understand the pieces without losing the sentence"
(思 / 思ったより / 〜より table) · "Your learning journey becomes context" (timeline) · "Practice
before the real thing" (JLPT N3 set) · "Mistakes become part of the lesson" (01–04 ✓/✕ + Explain) ·
"Your Japanese, all in one place" (あなたの日本語 hub + 9 chips). The owner's generating prompt
lists 18 sections and is in this session's transcript.

⚠️ **Two things to settle before any of it is built:**
1. **Do the five new sections go on DESKTOP too?** If mobile has them and desktop does not, one page
   carries two different contents — CLAUDE.md §6 calls that a defect, not a trade-off.
2. **The owner says a menu row scrolls to its section. It cannot, today** — the rows are Explore /
   Shadowing / Kanji / Grammar / Practice / Companion / Pricing / FAQ and no section has those
   names. The shipped sheet therefore carries the six existing NAV_ITEMS at their existing routes,
   and drops Pricing/FAQ, which have no URL anywhere (the footer renders them as plain text).

## Still true from earlier rulings — do not re-open

`347:6277` IS the design for `/` · the authenticated home stays `dashboard` at `/dashboard` ·
the frame's footer and its "A quieter way to keep going." section win over the reference ·
`346:6275` is the visual quality bar, stays out of the registry, and **must NOT be deleted** ·
imagery is AI-generated so there is no licensing question · **P13** PayOS only · **P14** auth is
email + Google + Apple, GitHub no · **Blender mascot renders are REJECTED** · mascot poses are
per-placement hand-picked with real alpha, five placements, `mix-blend-mode: screen` retired ·
"Save Sentence" → `/mining` · store affordances → the stores' own front pages.
