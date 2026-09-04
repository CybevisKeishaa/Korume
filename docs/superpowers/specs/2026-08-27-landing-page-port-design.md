# Landing page (`/`) port — Design

> **Status:** approved in brainstorming 2026-08-27. Not yet implemented.
> **Authority on WHAT to build:** `docs/product/landing-page-reconciliation.md`. This spec does not
> restate it and must not contradict it — where the two disagree, that document wins and this file
> is the bug (`CLAUDE.md` §6, "one fact, one home").
> **Predecessors:** `2026-08-23-screen-registry-phase-3-design.md` §9.1 (the identity ruling that
> made `347:6277` the design for `/`) · `docs/product/figma-frame-map.md` · `docs/product/screen-inventory.md`
> § Amendment C (the Figma-vs-spec conflict rule).
> **Run state:** `mem:landing_page_port_run_state`.

---

## 1. What this port is, in one sentence

Replace the placeholder `/` — today a single centred hero in
`app/[locale]/(marketing)/page.tsx` — with the full landing page that frame `347:6277` specifies,
built to the visual bar of reference `346:6275`, in both locales, with the five missing photographs
held behind one explicit asset boundary so that layout work is not blocked on them.

### 1.1 The four principles this port is held to

These are the user's framing, 2026-08-27, and they govern every decision below:

1. **`347:6277` rules structure and content** of the landing page.
2. **`346:6275` rules the visual quality bar — it is not a source to copy assets out of.**
3. **The spec and `docs/product/decision-register.md` rule WHAT may be claimed at all.**
4. **Where Figma is missing something the design language already covers, build the HOW; never
   invent the WHAT.**

---

## 2. Page composition — 11 marketing pieces

`app/[locale]/(marketing)/page.tsx` becomes an ordered composition of **11 marketing pieces**. They
are deliberately *not* all the same kind of thing: nine are body sections, and two — the nav and the
footer — are page chrome owned by `(marketing)/layout.tsx` rather than by the page.

| # | Piece | Kind | File |
|---|---|---|---|
| §0 | Nav | chrome (layout) | `components/layout/site-header.tsx` (extended) |
| §1 | Hero | section | `components/marketing/hero.tsx` |
| §2 | "…still struggle when Japanese starts moving." | section | `components/marketing/problem.tsx` |
| §3 | "Don't study Japanese in isolation." | section | `components/marketing/journey.tsx` |
| §4 | "Turn listening into something your mouth can do." | section | `components/marketing/pitch-showcase.tsx` |
| §5 | "Korume recommends what's just beyond…" | section | `components/marketing/recommendation.tsx` |
| §6 | "Everything connects." | section | `components/marketing/capability-chain.tsx` |
| §7 | "Private. Secure. Built on trust." | section | `components/marketing/trust.tsx` |
| §8 | CTA | section | `components/marketing/cta.tsx` |
| §9 | "A quieter way to keep going." | section | `components/marketing/signoff.tsx` |
| §10 | Footer | chrome (layout) | `components/marketing/site-footer.tsx` |

Two shared primitives sit alongside them:

- `components/marketing/section.tsx` — the body-section wrapper that owns vertical rhythm, the
  eyebrow, and the heading. §1–§9 use it; §0 and §10 do not. This is where G4 lives (§6 below).
- `components/marketing/asset-slot.tsx` — the pending-photograph boundary. This is where G1 lives
  (§5 below).

Each file stays under ~300 lines (`CLAUDE.md` §6); a section that outgrows that splits its card or
chip sub-component into its own file rather than growing.

### 2.1 Why `SiteHeader` is extended rather than replaced

`components/layout/site-header.tsx` is imported by exactly one file —
`app/[locale]/(marketing)/layout.tsx` (verified by grep, 2026-08-27). It is already the marketing
nav in everything but content, so extending it cannot affect `(app)`, `(auth)`, `(admin)`, or
`(protected)`.

⚠️ It is a **marketing** nav. It is not `NAV_GROUPS` and must not be derived from the screen
registry's nav fields — the registry describes the authenticated IA, this describes a sales page.

### 2.2 Nav destinations (user ruling, 2026-08-27)

The frame shows six nav labels. Two of them — Explore and Practice — have no matching route in
`lib/product/screen-registry.ts`. Choosing a destination is a WHAT decision, so it went to the user,
who ruled: **keep all six labels, map them onto routes that already exist. Do not add routes.**

| Label | Destination |
|---|---|
| Explore | `/shadowing/explore` |
| Shadowing | `/shadowing` |
| Kanji | `/kanji` |
| Grammar | `/grammar` |
| Practice | `/review` |
| Companion | `/companion` |

All six are protected routes. A signed-out visitor who clicks one is sent through login and returned
to the destination — the existing middleware already does this, and `lib/safe-redirect.ts` already
governs where it may return to. No new redirect behaviour is introduced.

Auth affordances follow **P14** — email, Google, Apple; **GitHub: no** — whatever any frame shows.
Any pricing affordance follows **P13** — PayOS only, and it links out rather than presenting a
provider choice.

### 2.3 Footer destinations (user ruling, 2026-08-27)

The same problem, larger: the frame's footer names **ten** destinations, of which a registry check on
2026-08-27 found exactly **two** that exist — `Home → /` and `Roadmap → /roadmap`. Pricing, FAQ,
Blog, About, Careers, Contact, Privacy Policy and Terms of Service have no route in
`lib/product/screen-registry.ts` and no page under `app/[locale]/`.

Ruling 3 (§11) says the frame's footer wins outright and its content may not change. Hiding the
eight labels would change it; pointing them at routes that do not exist would ship broken links. The
user ruled the third way:

> **Keep every label. A label whose destination exists is a link; a label whose destination does not
> exist yet renders as text, not as an `<a>`.**

| Label | Treatment |
|---|---|
| Home | link → `/` |
| Roadmap | link → `/roadmap` |
| Contact | link → `mailto:` the address from `lib/contact.ts` |
| Pricing · FAQ · Blog · About · Careers · Privacy Policy · Terms of Service | text, not a link |

Nothing about the footer's structure or wording changes; only the `href` is withheld. Adding a page
later is one `href`.

**The same rule extends, unasked, to the rest of the footer's outbound affordances**, because it is
the same question with the same answer: the Discord / Facebook / TikTok entries and the App Store and
Google Play blocks (the frame has **both** stores; the reconciliation document mentions only the App
Store) render as text until a real URL exists. No placeholder URLs, no `#`.

The support address is **derived from `lib/contact.ts`'s `SUPPORT_EMAIL`**, never re-typed — that
module exists precisely so the footer and the deletion email cannot drift (`CLAUDE.md` §6).

---

## 3. The four cross-cutting gaps and where each one is fixed

The reconciliation document names four gaps (its §3). This spec assigns each a single owner in code,
so that "did we fix G2?" has one place to look rather than nine.

| Gap | Owner in code |
|---|---|
| **G1** imagery missing | `components/marketing/asset-slot.tsx` (§5 below) |
| **G2** connective linework missing | three per-section treatments (§4 below) |
| **G3** pitch visualizer is the wrong form | `lib/pitch/plot.ts` + `pitch-showcase.tsx` (§7 below) |
| **G4** density | `components/marketing/section.tsx` (§6 below) |

---

## 4. G2 — connective linework

The reference *links* things; the frame leaves loose boxes. Three sections need it, and they need
three genuinely different treatments, so they are **not** unified behind one abstraction. Only §3's
arrow is shared, because only §3's arrow repeats.

- **§2 — constellation.** Dotted rays from a glowing centre node out to the six capability chips
  that surround the centred Japanese example.
- **§3 — step arrows.** A `StepArrow` between each adjacent pair of cards: **five cards, four
  arrows, one horizontal row.** §3 is the only section where the frame is structurally wrong rather
  than merely unpolished — it currently stacks cards 1 and 5 in a left column with 2/3/4 in a right
  row, and a single arrow for the whole section.
- **§6 — threaded chain.** One horizontal dotted thread running behind eight circular nodes, with
  amber glow points beneath it.

### 4.1 These are decorative, not data

⚠️ **All three treatments express a decorative relationship, not an interactive or data-bearing
connector.** Nothing about them is derived from user state, SRS data, or the difficulty engine, and
nothing in them is clickable. A future implementer reading the SVG must not conclude it represents a
real relationship and set out to wire it to one.

Consequences, all mandatory:

- every connector element is `aria-hidden="true"` and reachable by neither tab nor screen reader;
- the meaning a sighted user takes from a connector is carried in the text content regardless, so
  removing the SVG entirely loses decoration and nothing else;
- any glow or draw-on animation is gated behind `prefers-reduced-motion` (`CLAUDE.md` §2 rule 4).
  Under reduced motion the connectors render in their final state, statically — they do not vanish.

---

## 5. G1 — the asset boundary

### 5.1 `asset-slot.tsx`

▶ **UPDATE 2026-09-04: all of these have been delivered** and every `AssetSlot` call site now passes `src`; the analysis below is kept as the reason the boundary exists, not as a live gap. They arrived across 2026-08-28 to 2026-09-01 rather than on one day — the record is `git log --diff-filter=A --date=short -- public/marketing/`, and no date is restated here.

Five photographs the reference carries do not exist in the repo: the §1 hero video still (Kyoto
street at dusk), the §2 learner at a night desk, the §5 Tokyo commute still, the §7 lit window, and
the §8 CTA night background. `asset-slot.tsx` is the single component that stands in for all five.

- It takes a fixed aspect ratio, an accessible description, and an optional `src`.
- With no `src` it renders a token-styled pending state that is **visibly and honestly a placeholder**
  — never a decorative gradient that could be mistaken for finished art.
- With a `src` it renders `next/image`.

Swapping a real photograph in later is therefore **one prop at one call site**, with no layout
change. That property is the whole reason the boundary exists.

### 5.2 Asset provenance is a standing concern, not a solved one

The reference `346:6275` is a **flat PNG**: its photographs exist only as pixels baked in at capture
resolution. **They must not be sliced out and shipped.** Doing so would ship art at the wrong
resolution and would launder an asset whose provenance the repo never recorded.

The licensing question is separately **ruled and closed** (user, 2026-08-26): the imagery is
AI-generated, so no stock licence or attribution is owed, and `CLAUDE.md` §2.3 does not apply — it
is scoped to study content (kanji, vocab, grammar, JLPT items), not marketing imagery. Do not
re-escalate on that citation.

What remains is a **file** problem and a **provenance** problem: a real image file has to arrive from
the user's original generations or a fresh generation to the same direction, and `asset-slot` exists
so that a slot stays visibly empty until one does. **A slot may only be filled from a source whose
origin is known and recorded.** Filling one by cropping the reference is a defect.

### 5.3 Mascot — a separate case with a verified source

⚠️ **The Blender renders were rejected by the user (2026-08-27) as broken and low quality, and
`public/mascot/renders/` was DELETED on the owner's ruling (2026-09-02).** They must not be
reinstated or regenerated without a fresh ruling. This paragraph previously said removing them was
out of scope and needed its own decision; that decision has now been taken. The files stay
recoverable from git history, so the deletion is reversible and the record above is not the only
copy.

The mascot is **not** part of the `asset-slot` pending set, because a usable source does exist. An
inventory of `public/mascot/` (2026-08-27) found seven non-render files. **On 2026-09-02 all seven
moved out of `public/`** — build-time source art has no business being served to every visitor —
so `ls assets/mascot/sheets/ assets/mascot/source/` enumerates them now. `sheets/` holds the two
`scripts/mascot/poses.json` actually reads; `source/` holds the other five, which no code reads and
which are kept as provenance. The table below groups two of them on one row because they are the
same sheet:

| File | Size | What it is |
|---|---|---|
| `Korume.png` | 1402×1122, RGB | the mascot on the glowing orb, **cut out on pure black** (all four corners `(0,0,0)`) |
| `Gemini_Generated_Image_55h5tu55h5tu55h5.png` | 1152×922, RGBA (alpha fully opaque) | the same scene with a library-shelf background |
| `upscalemedia-transformed (1).png` | 2508×2508 | master character sheet v1.0 — turnaround ×5, expressions ×18, poses ×7, details |
| `upscalemedia-transformed (4).png` | 3072×2048 | companion sheet — 12 poses + 14 emotions, Vietnamese labels |
| `upscalemedia-transformed (5).png` | 3072×2048 | companion sheet — 14 poses + 16 emotions, Vietnamese labels |
| `Emotion.png` / `upscalemedia-transformed.png` | 1254² / 2508² | the same sheet; the 2508² file is the 2× upscale, so prefer it |

**Two measurements decide how the mascot ships**, both taken 2026-08-27 and both re-runnable:

1. **All four reference mascot placements are the same pose.** Cropping §1's Companion card, §4's
   Companion card, §6's chain end and §8's CTA out of `346:6275` and viewing them side by side shows
   one character in one pose — seated on/behind the glowing orb, tails fanning right, small
   companion orb at the left. So **one asset covers all four placements at four scales**; four
   separate poses are not required.
2. **`Korume.png` composites onto the page background with no matting.** The page background token
   is `--void-950` = `#0b0d11`. Because the file is a light character cut out on pure black,
   `mix-blend-mode: screen` maps its black exactly onto the background (`screen(0, bg) = bg`) while
   preserving the soft glow falloff of the tails. A simulated composite showed no halo, no
   rectangle, and no edge artefact. This is what the reference itself does with the mascot.

> ⚠️ **SUPERSEDED BY THE USER, 2026-08-28.** Everything above stays as the record of what was
> measured, but the conclusion it reached no longer holds. The user ruled that each placement gets
> its own hand-picked pose, cut out of the character sheets with background removed — "cần thiết thì
> hãy xóa nền hay làm bất cứ thứ gì, miễn là cho nó thật đẹp và ưng mắt" — and that the footer gets
> a mascot card too, which §5.3 had excluded. What actually ships:
>
> - **Five placements**, not four: §1, §4, §6, §8 and the §10 footer card.
> - **Five different poses**, cut by `scripts/mascot/extract.js` per
>   `scripts/mascot/poses.json`, which is also the provenance record §5.2 asks for. The manifest
>   names the sheet, the point in it, what the pose is and which slot it fills.
> - **Real alpha, and `mix-blend-mode: screen` is retired.** The blend only ever composited
>   correctly because `Korume.png` is cut out on pure black; that is exactly what limited the mascot
>   to dark surfaces.
> - The §10 pose is the **sleeping** one. The frame names its image
>   `KorumeSleepingPeacefullyOnABook` (`347:7101`) and §9 directly above reads "The day can end
>   softly", so the frame and the copy agree.
>
> The two objections in the paragraph below — that the sheets carry opaque backgrounds needing real
> matting, and pre-rebrand "NIHONGO CINEMA" chrome — were both answered by measurement rather than
> waived. The matte is connectivity-based, not a luminance threshold, so it does not bite into a
> cream character on cream ground; and sheet chrome is excluded structurally, because a crop is
> masked to its own connected component rather than to a rectangle. `scripts/mascot/matte.js`
> carries the detail.

The superseded conclusion, kept for the record: **§1, §4, §6 and §8 use `Korume.png`, screen-blended
over the dark surface, at four different scales.** No cutout, no matting, no alpha authoring.

The character sheets are **not** used in the initial port. They carry opaque grey/cream backgrounds
that would need real matting — lossy on a translucent, glowing character — and two of them carry the
**pre-rebrand wordmark "NIHONGO CINEMA"** in their chrome, so any future crop must exclude sheet
chrome as well as background. They remain the right source for later work such as per-expression
Companion avatars.

Following the user's wording, and now with the evidence above behind it:

> Mascot uses existing non-render assets from `public/mascot/` for the initial port. Exact pose
> parity with the reference is not a Phase-1 asset requirement; if a later visual review finds a
> materially wrong pose, mascot assets can be swapped independently of layout.

---

## 6. G4 — density

Normalised to the same width, the reference renders ~2698px tall and the frame renders 4028px — the
frame is about 1.5× looser for the same content, only partly explained by its extra sign-off section
and larger footer.

The fix is structural, not per-section: `components/marketing/section.tsx` owns the vertical rhythm,
the eyebrow, and the heading for §1–§9, so no two sections can drift apart by accident. Tightening
the page means changing one component.

⚠️ **`~2698px` is a visual review target, not a hard number.** It must never become an assertion —
no `expect(height).toBe(2698)`, no threshold test. Responsive typography, font loading and
rendering, viewport width and content wrapping all move it legitimately. It is checked in a browser
by a human, in the same pass that checks composition, and it is judged as "does this read as dense
as the reference" rather than as a number.

---

## 7. G3 — the pitch visualizer

§4's reference draws **two smooth contour curves overlaid** — Native in orange, You in grey. The
frame draws alternating orange/grey vertical bars. Pitch is a continuous quantity, so the bar form
does not merely look worse: it misrepresents the product's own headline differentiator
(`CLAUDE.md` §5 #1). §3's step-3 card has the same defect at smaller scale, where a waveform belongs.

The reconciliation document requires the landing page's showcase to be "the *same shape* as the real
one". **That is enforced by shared code, not by eyeballing:**

1. Extract the plotting mathematics currently private inside
   `components/video-player/pitch-contour.tsx` — `toPlotPoints`, the semitone mapping, the minimum
   span and range padding — into **`lib/pitch/plot.ts`**. Pure functions, no DOM, no canvas, no SVG,
   matching the existing convention in `lib/pitch/contour.ts` ("the renderer decides pixels; this
   module decides the values it plots").
2. `components/video-player/pitch-contour.tsx` consumes the extracted module. Its existing tests
   must stay green; this is a refactor with no behaviour change.
3. `components/marketing/pitch-showcase.tsx` renders **two** contours as SVG paths through the same
   module.

If the real renderer's plotting changes, the landing page's changes with it. That is the point.

### 7.1 The demo data is design mock data

The two contours are fixtures in **`lib/marketing/pitch-demo.ts`**, expressed as `PitchContour`
values (`{ frames: { time, hz | null }[], sampleRate }`) so they travel through the same types as
real audio.

⚠️ **These numbers are illustrative design mock data, not measurement.** So are §4's four sub-scores
(Pitch 86 · Rhythm 84 · Pronunciation 82 · Timing 90) and its Overall Score of 87. They illustrate
what the feature shows a user; they are **not a claim about scoring accuracy**, and no future
implementer should read `86/84/82/90` as product data, a benchmark, or a target. The fixture module
says so in a comment at the top of the file, next to the data, where someone changing it will read
it.

---

## 8. Copy and localization

### 8.1 Where English copy comes from

From `347:6277`'s text layers, via `get_design_context`, at port time.

⚠️ **Not from `get_metadata`.** Metadata truncates text node names at 50 characters — measured
2026-08-27, where §6's heading came back as `"Everything connects. Everything builds on each oth"`.
Metadata is for structure and node ids only.

Nor from the reference: `346:6275` is a flattened image whose small type is not reliably legible, and
where the reconciliation document quotes copy it is identifying *which line is meant*, not supplying
the string to ship.

### 8.2 Two exceptions — the frame's repeated placeholders

The frame repeats one placeholder string across a whole set of items in **two** sections, not one.
The reconciliation document names only §6; §2 was found the same way on 2026-08-27, while extracting
copy for this plan. Both are content, so neither may be invented.

#### 8.2.1 §2's six chip sub-labels

All six chips in the frame carry the identical sub-label `"Learn in context"` (nodes `347:6450`,
`6467`, `6483`, `6506`, `6518`, `6531`). The reference gives six distinct ones. Three read cleanly
off the reference; three are Japanese at the edge of legibility and were **confirmed by the user**
(2026-08-27) rather than guessed, because shipping guessed Japanese is a product defect:

| Chip | Sub-label |
|---|---|
| Vocabulary | 安い・思う・店 |
| Grammar | 比較・より |
| Kanji | 店・思・安 |
| Pronunciation | Pitch & Rhythm |
| Listening | Real Audio |
| SRS Review | Long-term Memory |

All six are drawn from the section's own example sentence, 「この店、思ったより安いね。」 — which is the
section's argument: one real sentence teaches all six things at once.

#### 8.2.2 §6's eight captions

The frame carries eight real node titles — Video & Context · Shadowing · Kanji · Vocabulary ·
Grammar · JLPT Practice · Conversation · Memory & Review — but **all eight captions are the same
placeholder string**, `"Learn naturally, one layer at a time."` (verified across nodes `347:6855`,
`6868`, `6886`, `6900`, `6917`, `6931`, `6946`, `6964`).

The captions are content, not styling, so they may not be invented. They were read from the
reference at native resolution on 2026-08-27 and are legible:

| Node | Caption |
|---|---|
| Video & Context | Real Japanese from real life. |
| Shadowing | Speak it. Hear it. Make it yours. |
| Kanji | Understand the characters deeply. |
| Vocabulary | Learn in context. Remember longer. |
| Grammar | See patterns. Use naturally. |
| JLPT Practice | Prepare with focus and confidence. |
| Conversation | Talk with Korume. Improve naturally. |
| Memory & Review | Korume remembers. You grow. |

### 8.3 Locales

Every string lands in `messages/en/marketing.json` and `messages/vi/marketing.json`, namespaced per
piece (`nav.*`, `hero.*`, `problem.*`, `journey.*`, `pitch.*`, `recommend.*`, `chain.*`, `trust.*`,
`cta.*`, `signoff.*`, `footer.*`).

`lib/i18n/catalog.test.ts` already enforces identical key sets, identical ICU argument names, and
identical rich-text tag names across locales, so an English-only intermediate state is not
representable. The Vietnamese copy is drafted in the voice already established in
`messages/vi/marketing.json` and reviewed by the user in one pass at the end (user ruling,
2026-08-27).

### 8.4 No `marketing.pin.test.ts`

The repo's `*.pin.test.ts` files are characterization tests for **extraction**: they prove a string
that used to be hard-coded moved into the catalog verbatim, and their binding rule is that the
expected value is copied from a pre-extraction source in git, never derived from the catalog.

New copy sourced from Figma has no such prior source in the repo. A pin test over it would restate
the catalog against itself — a guard that cannot fail, which is exactly what `docs/lessons.md` L-004
forbids. Copy is therefore held once, in the catalog; the tests below assert **structure**.

---

## 9. Testing

TDD as always (`CLAUDE.md` §7): the failing test first.

**Per-piece RTL tests.** Each asserts its heading renders and its collection renders — and every
assertion over a collection gathered by a pattern also asserts the collection is **non-empty and of
the expected size** (`CLAUDE.md` §7 / L-004):

| Piece | Expected collection |
|---|---|
| §0 | 6 nav links, each with the destination from §2.2 |
| §2 | 6 capability chips, each with a **distinct** sub-label |
| §3 | 5 step cards **and** 4 arrows |
| §4 | 4 sub-scores, 2 contour paths |
| §6 | 8 nodes, 8 captions |
| §7 | 3 trust cards |

**Four placeholder guards**, two per affected section, because §2 and §6 are where the frame's
repeated placeholders could leak (§8.2):

- `"Learn naturally, one layer at a time."` appears **zero** times in §6's rendered output;
- §6's eight captions are **pairwise distinct** (a `Set` of them has size 8);
- `"Learn in context"` appears **zero** times in §2's rendered output;
- §2's six sub-labels are **pairwise distinct** (a `Set` of them has size 6).

All four are written over code that will already exist by then, so none can fail first. They are
**mutation-checked** instead (`CLAUDE.md` §7): break the thing each guards, watch it go red, restore,
and report both outputs in the task's report.

**`lib/pitch/plot.ts`** gets deterministic unit tests — required for pitch logic by `CLAUDE.md` §7 —
and `components/video-player/pitch-contour.test.tsx` must stay green across the extraction.

**One Playwright spec**: `/` renders all eleven pieces in document order and is fully
keyboard-navigable.

**Accessibility** (`CLAUDE.md` §2 rule 5, §9): WCAG AA contrast — `lib/design-tokens.contrast.test.ts`
already covers the tokens, so sections must use tokens rather than raw colours; every connector
`aria-hidden`; every `asset-slot` carries a real description; `prefers-reduced-motion` honoured by
every animation.

**Not tested:** page height (§6), and the visual composition itself. Those are a human browser pass.

---

## 10. Task sequence

One branch, `landing-page-port`. Thirteen tasks, in order:

1. `marketing.json` catalog for all pieces, `en` + `vi`
2. `section.tsx` + `asset-slot.tsx` primitives
3. §0 nav + §10 footer (the frame's footer wins outright — see §11)
4. §1 Hero
5. §2 Problem + constellation
6. §3 Journey row + arrows
7. `lib/pitch/plot.ts` extraction, then §4 pitch showcase
8. §5 Recommendation + donut
9. §6 Capability chain
10. §7 Trust
11. §8 CTA + §9 Sign-off
12. Page composition + the Playwright spec
13. Density pass, reduced-motion sweep, a11y sweep

§8 and §9 share a task because §9 is a four-line sign-off that would not carry its own review gate.
The step-by-step form of this sequence is `docs/superpowers/plans/2026-08-27-landing-page-port.md`;
that plan is the executable copy and this list is the shape — if they ever disagree, the plan is what
runs and this section is the bug.

Then a **whole-branch review before merge** (`CLAUDE.md` §9, `docs/lessons.md` L-011) — required even
though every task is reviewed on its own — and lessons written to `docs/lessons.md` per its four
entry rules.

---

## 11. Rulings this port inherits and must not re-litigate

From the user, 2026-08-26 unless noted:

1. **`347:6277` IS the design for `/`** — not a separate destination.
2. **The authenticated home stays `dashboard` at `/dashboard`.** A `/home` rename was offered and
   declined. `/dashboard` appears in ~89 files including the post-login redirect, middleware, and the
   safe-redirect tests. Do not touch it.
3. **The frame's footer wins outright** over the reference's. It carries real data the reference does
   not — `admin@almostgone.vn`, Discord / Facebook / TikTok, an App Store affordance, a "Take your
   next with you." block. Do **not** substitute the reference's Product/Learn/Company/Resources/Legal
   column set. Visual polish is allowed only where it changes neither structure nor content.
4. **§9, "A quieter way to keep going.", stays.** Frame-only; the reference does not have it. Polish
   to the reference's bar is allowed, changing the content is not.
5. **`346:6275` is the visual quality bar, stays out of the screen registry, and must NOT be deleted**
   in any Figma cleanup pass. It renders blank if it is hidden — check `get_metadata` before
   concluding it is empty (L-019).
6. **Imagery is AI-generated → there is no licensing question.** See §5.2.
7. **P13** — payments are PayOS only. **P14** — auth is email + Google + Apple, GitHub: no.
8. **Blender renders are rejected** (user, 2026-08-27). See §5.3.
9. **Footer destinations** (user, 2026-08-27): every label stays; only labels with a real
   destination become links. See §2.3.
10. **§2's six chip sub-labels** (user, 2026-08-27): the three Japanese ones are confirmed, not
    guessed. See §8.2.1.
11. **§7's three claims** — recordings stay private · your data is yours · AI with boundaries — match
   the `CLAUDE.md` §2 non-negotiables exactly and ship **verbatim**. They are promises, not copy.

---

## 12. Known limits of this design

- Neither `347:6277` nor `346:6275` was ever compared against the **built** `/`, which predates both
  by months. `impl: "built"` on the `landing-page` registry row has never meant the built page
  matched a frame.
- Every dimension quoted from the reference is a render dimension, not a design token. Nothing in
  `346:6275` is measurable — it has no layers.
- This spec goes stale if either Figma node changes. Re-derive with the recipe in
  `docs/product/landing-page-reconciliation.md` §7 rather than trusting it.

---

## 13. G5 — motion and visual expressiveness (user ruling, 2026-08-28)

A fifth gap, opened after §1–§4 and §10 were built and seen in a browser. It is the user's verdict
on shipped work, not a prediction, and it outranks the four principles' silence on the subject.

**What was judged.** §2 Problem (`problem.eyebrow`, "Tiếng Nhật không phải một quyển sách giáo
khoa"), §3 Journey (`journey.eyebrow`), §4 Pitch (`pitch.eyebrow`). The verdict on §2 was the
sharpest: its composition reads **markedly worse than `346:6275`** — "bố cục nó xấu hẳn so với ảnh
png, sắp xếp cũng xấu, nhìn khô". The linework across all three — §2's constellation rays, §3's step
arrows, and above all the **pitch contour** (§4's chart and the mini preview inside §3's Shadow
card) — is flat where the reference is expressive: "cái sóng tôi muốn đặc sắc hơn".

**Why this was not caught earlier, and what it says about the gates.** Every one of those sections
passed its task review, and none of the gates that passed them can see this. A catalog-coverage
guard proves a string reached the DOM. A Rule #0 scan proves no hardcoded number. jsdom proves
structure. **All of them are satisfied by a section that is correct and lifeless.** The port had
been treating "the decorative element is structurally present, aria-hidden, and motion-safe" as
finished, when for these sections presence is the floor, not the bar.

### 13.1 The rule

1. **Motion is a requirement for §2, §3, §4 and §5, not Task 13 polish.** The stack is already
   chosen (`CLAUDE.md` §3): GSAP + ScrollTrigger, Lenis, Framer Motion. The role is
   `motion-engineer`, not `frontend-engineer`.
2. **Visual fidelity to `346:6275` is a requirement for these sections**, alongside the density
   Task 13 already owns. §6 of this spec scopes the reference to a *density* target; that scope is
   too narrow. Composition, arrangement and the expressiveness of the linework are in scope too.
3. **Every remaining section task builds to this bar from the start.** §5 Recommendation is named
   explicitly — "những phần recommendation cũng sẽ cần đặc sắc và giống ảnh png hơn". A section that
   is merely correct is not done.
4. ⚠️ **Reduced motion stops being satisfiable by accident.** §2's constellation currently passes
   that gate *vacuously* — it has no animation, so nothing can be removed. The moment motion is
   added, `CLAUDE.md` §2 rule 4 and this spec's §4.1 become real, testable requirements:
   **reduced motion removes movement and nothing else** — every connector still visible in its final
   state, every mascot still present, no section collapsed or blank.
5. **Build the motion vocabulary once, then reuse it.** These are four sections wanting a coherent
   signature, not four independent effects. The primitives belong in shared modules the later
   sections consume — the same shape as `components/marketing/section.tsx` for rhythm and
   `lib/pitch/plot.ts` for the contour maths.

### 13.2 What this does not license

Nothing here weakens §4.1. Decorative linework stays decorative: `aria-hidden`, unreachable by tab
or screen reader, and content-preserving. "More expressive" is a visual instruction, not permission
to move meaning into an animation. And `CLAUDE.md` §2 rule 4 still stands over the whole app — no
heavy autoplay animation inside repeated study loops; this is a marketing page, which is precisely
why it is the one surface where a cinematic signature belongs.
