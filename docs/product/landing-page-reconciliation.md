# Landing page (`/`) — visual reconciliation

> **What this is.** The landing page has three sources that disagree, and each is authoritative over
> a different thing. This file records which wins where, and what the gap actually is, section by
> section. It is the input to porting `/` — not the port itself, and not a second Figma.
>
> **Written 2026-08-26**, from a direct comparison of the two renders. It is a *reconciliation*
> document: it goes stale the moment either Figma node changes. Re-derive rather than trust it if
> the node ids below have moved.

---

## 1. The three sources and what each one rules

| Source | What it is | Authoritative over |
|---|---|---|
| **`347:6277`** ("Homepage", 1280×4028) | The layered Figma frame. Registered as `landing-page` → route `/` (user ruling, 2026-08-26). | **Structure**: which sections exist, in what order, with what message. **Content** of the footer and of the "A quieter way to keep going." section — the user built those deliberately. |
| **`346:6275`** ("Homepage", 864×1821) | A **flat image**, zero children — a picture of a finished design. Never registered; nothing can be derived from it. | **Visual quality bar**: density, composition, imagery, linework, chart form, how finished it should feel. |
| `japanese-learning-app-spec.md` + `docs/product/decision-register.md` | The product. | **WHAT may be claimed at all** — capabilities, flows, destinations, product semantics. |

**The rule that resolves conflicts** (Amendment C, `docs/product/screen-inventory.md`): Figma rules
*how it is presented*; spec and decision register rule *what*. Where `347:6277` and `346:6275`
disagree, the split above applies — the frame's *arrangement* loses to the reference's, the frame's
*footer and sign-off content* wins.

⚠️ **`346:6275` must not be deleted in any Figma cleanup pass.** It was mis-filed as "decorative
canvas noise" from 2026-08-23 to 2026-08-26 because it was hidden and screenshotted blank. See
`docs/product/figma-frame-map.md`.

---

## 2. The boundary a porter may not cross

**May decide alone (HOW):** layout, spacing, density, visual hierarchy, imagery selection and
placement, connective linework, chart *form*, animation and scroll behaviour, responsive breakpoints.
These are what §3 and §4 below are about, and the reference image is the target.

**May NOT decide (WHAT):** adding a capability, a claim, a flow, a route, a nav entry, or product
semantics that the spec and decision register do not already carry. A missing section is a question
for the user, not a gap to fill with invention.

Two rulings already bind here and must not be re-litigated:
- **P13** — payments are PayOS only. Any pricing/checkout affordance on this page links out; it does
  not present a provider choice.
- **P14** — Auth = email + Google + Apple, **GitHub: no**. If any auth affordance appears on this
  page, it does not offer GitHub, whatever a frame shows.

---

## 3. The four cross-cutting gaps

These are not per-section defects; they are the same four failures repeated down the page, and they
are the whole reason the frame reads as a prototype and the reference reads as a product.

**G1 — Imagery is missing.** The reference carries five photographs (Kyoto street at dusk in the hero
player; a learner in headphones at a night desk in §2; a Tokyo commute still in §5; a lit window in
§7; a lantern-lit bridge behind the §8 CTA) and four renders of the mascot (§1 Companion card, §4
Companion card, §6 end of the chain, §8 CTA). The frame has **zero mascot**, an **empty black
rectangle** where the hero player's still belongs, and a garish neon placeholder in §5 that is not
the commute image. Its §8 background is present but so dark it reads as flat black.
→ Mascot renders already exist at `public/mascot/renders/*.png`. Photography does not, and is the
single largest unresolved dependency of this port — see §6.

**G2 — Connective linework is missing.** The reference *links* things: §2's six capability chips
surround the example sentence and connect to it with dotted lines through a glowing centre node;
§6's eight capabilities sit in circular nodes threaded by a horizontal dotted line with amber glow
points beneath; §3's five steps are joined by an arrow between each pair. In the frame all three are
**loose boxes with nothing between them**. This is the most visible single difference.

**G3 — The pitch visualizer is the wrong form, and wrongly so.** §4's reference is **two smooth
contour curves overlaid** (Native in orange, You in grey) — a pitch contour. The frame draws
**alternating orange/grey vertical bars**. Pitch is a continuous quantity, so the bar form is not
merely less attractive, it misrepresents the product's own differentiator (`CLAUDE.md` §5 #1: pitch
accent visualization). §3's step-3 card has the same problem at smaller scale: a crude bar cluster
where a waveform belongs.
→ Owners per `CLAUDE.md` §5: `motion-engineer` for the contour rendering, `/lib/pitch` for the data
shape. The landing page's version is a static/scripted showcase, not a live scorer, but it must be
the *same shape* as the real one.

**G4 — Density.** Normalised to the same width, the reference is ~2698px tall and the frame is
**4028px** — about 1.5× taller for the same content, and only partly explained by the frame's extra
sign-off section and larger footer. The frame's sections are simply looser. Composition, not scale.

---

## 4. Section by section

Order and headline copy are the frame's. "Reference" describes `346:6275`; "Frame" describes
`347:6277` as it renders today; "Build" is the instruction.

**§0 — Nav.** Korume · Explore · Shadowing · Kanji · Grammar · Practice · Companion · Log in ·
Get Started (orange pill). **Identical in both.** Build as-is. Note it is a *marketing* nav — it is
not `NAV_GROUPS` and must not be derived from the registry's nav fields.

**§1 — Hero.** *"Learn Japanese from the Japanese you actually want to understand."*
- Reference: copy + CTAs left; right is a video card ("Travel to Japan: Kyoto in Autumn", N5, 13 min)
  with a real photographic still, player chrome and a scrub position, then Transcript / Japanese /
  English / Notes tabs over three transcript lines, a Companion card with the mascot, and a right rail
  — "Sentence 1/26", the Japanese line, romaji, English, three Key Words, "Save Sentence".
- Frame: same skeleton, but the still is **an empty black rectangle**, there is no player chrome, the
  Companion card is a dot and two lines with no mascot, and the Key Words list is clipped.
- Build: the reference's composition. This is the page's single most important image (G1).

**§2 — *"You can study Japanese for years and still struggle when Japanese starts moving."***
- Reference: six chips (Vocabulary · Grammar · Kanji / Pronunciation · Listening · SRS Review) arranged
  *around* a centred Japanese example with a glowing node and dotted connectors; a full-bleed
  photograph of a learner at a night desk occupies the right third.
- Frame: the six chips are squeezed into the right third in two flat rows, no connectors, no glow, and
  **no photograph at all** — the right side is empty background.
- Build: restore the constellation (G2) and the photograph (G1).

**§3 — *"Don't study Japanese in isolation."***
- Reference: **one horizontal row of five equal cards** — 1 Watch · 2 Understand · 3 Shadow · 4 Mine ·
  5 Remember — with an arrow between each pair. Card 1 carries a photo thumbnail, card 3 a waveform,
  card 5 an SRS dot calendar.
- Frame: **the row is broken.** Cards 1 and 5 are stacked in a left column while 2/3/4 sit in a right
  row; there is a single arrow for the whole section; card heights are unequal.
- Build: the five-across row with four arrows. This is the one section that is structurally wrong
  rather than merely unpolished.

**§4 — *"Turn listening into something your mouth can do."***
- Reference: dual pitch contour with a Native/You legend; the Japanese line and romaji beneath the
  axis; four sub-scores (Pitch 86 · Rhythm 84 · Pronunciation 82 · Timing 90); Overall Score 87
  "Great!"; a Companion card with the mascot breaking the card's edge.
- Frame: a **bar chart** instead of contours; sub-scores and 87 present; Companion card is a plain box
  with no mascot.
- Build: contours (G3) + mascot (G1). The numbers are design mock data — they illustrate the feature,
  they are not a claim about scoring accuracy.

**§5 — *"Korume recommends what's just beyond what you already know."***
- Reference: three cards — a recommendation with the Tokyo commute still and an "i+1 Perfect Next Step"
  badge; a 96% donut with "Familiar Words", "New Words: 8", topic chips (Daily Life, Commuting) and the
  orange CTA; and "Why this video?" with four reasons.
- Frame: the photo is a **different neon placeholder**; the donut reads "96" without the percent
  treatment; the topic chips and the "New Words" line are **absent**; the reason list is present but
  set very small.
- Build: correct image, restore the chips and the New Words line. The i+1 claim itself is spec-backed
  (`CLAUDE.md` §5 #2) — do not soften or embellish it.

**§6 — *"Everything connects. Everything builds on each other."***
- Reference: eight circular nodes on a dotted thread with amber glow points, mascot closing the chain,
  and **eight distinct captions** — "Real Japanese from real life", "Speak it. Hear it. Make it yours.",
  and so on.
- Frame: eight plain boxes, no thread, no mascot, and **every caption is the same placeholder string**,
  *"Learn naturally, one layer at a time."*
- Build: the threaded chain (G2) + mascot (G1). ⚠️ The eight captions are **content**, not styling —
  take them from the frame's text layers if they are real there, otherwise from the reference, and if
  neither is legible, ask. Do not write eight new taglines.

**§7 — *"Private. Secure. Built on trust."*** Three cards, identical content in both (recordings stay
private · your data is yours · AI with boundaries). Reference adds a warm photograph on the right;
the frame leaves it empty. Build: add the image (G1). ✅ The three claims match `CLAUDE.md` §2
non-negotiables exactly — keep them verbatim, they are promises.

**§8 — CTA, *"Start understanding Japanese differently."*** Full-bleed night photograph, two buttons,
a one-line note, mascot at right. The frame has the photograph but washed out and no mascot. Build:
the reference's treatment.

**§9 — *"A quieter way to keep going."*** ✅ **Frame only — the reference does not have this section,
and the frame wins** (user ruling, 2026-08-26). A quiet sign-off after the CTA: *"The day can end
softly. Your Japanese will still be here tomorrow."* Build as designed; polish to the reference's
bar is allowed, changing the content is not.

**§10 — Footer.** ✅ **Frame wins outright** (user ruling, 2026-08-26) — this is the footer the user
built. It carries real data the reference does not: `admin@almostgone.vn`, Discord / Facebook /
TikTok, an App Store affordance, and a "Take your next with you." block. Do **not** substitute the
reference's Product/Learn/Company/Resources/Legal column set. Visual polish to the reference's bar is
allowed **only where it does not change structure or content**.

---

## 5. Assets this port needs

| Asset | Status |
|---|---|
| Mascot renders (4 placements) | ⚠️ renders exist (`public/mascot/renders/` — `final_front`, `final_3q`, `final_side`, seven `expr_*`), but **nobody has checked them against the poses the reference uses**, which sit on an ornate lamp/vessel prop. Treat as "an asset set exists", not "the right asset exists". |
| Hero video still (Kyoto street, dusk) | ❌ none in repo |
| §2 learner-at-desk photograph | ❌ none in repo |
| §5 Tokyo commute still | ❌ none in repo |
| §7 lit-window photograph | ❌ none in repo |
| §8 CTA night background | ⚠️ present in the frame but too dark to use as-is |

⚠️ **The photography is the port's real blocker, and it is a licensing question, not a design one**
(`CLAUDE.md` §2.3 — licensed sources must be checked and attributed). The images in `346:6275` are
baked into a flat PNG and cannot be extracted as licensed assets. Decide the source before building
§1, §2, §5 and §7: original photography, a licensed stock set, or a different visual treatment
altogether. **Nothing about this is a porter's call to make silently.**

---

## 6. Known limits of this document

- `346:6275` is a **flattened image**. Its small type is not reliably legible at the resolution
  captured, so **all exact copy must come from `347:6277`'s text layers** (`get_design_context`) at
  port time, never transcribed from the reference. Where this file quotes copy, treat it as
  identifying which line is meant, not as the string to ship.
- No spacing, type scale or colour value here was *measured* — the reference has no layers to measure.
  Every number in §3 (heights) is a render dimension, not a design token.
- This is a comparison of two designs. **Neither was compared against the built `/`**, which predates
  both by months; `impl: "built"` on the registry row has never meant the built page matches a frame.

## 7. How to re-derive this

```
# both renders, at the sizes compared here
mcp__figma-desktop__get_screenshot  fileKey=IwFHZDZdHW7qsSFiNbWrkd  nodeId=346:6275  maxDimension=2600
mcp__figma-desktop__get_screenshot  fileKey=IwFHZDZdHW7qsSFiNbWrkd  nodeId=347:6277  maxDimension=2720
```

`346:6275` renders blank if it has been hidden again — check `get_metadata` before concluding it is
empty (`docs/lessons.md` L-019).

**Related:** `lib/product/screen-registry.ts` (`landing-page` row) · `docs/product/figma-frame-map.md`
§ "Second capture batch (2026-08-23)" · `docs/superpowers/specs/2026-08-23-screen-registry-phase-3-design.md`
§9.1 (the identity ruling) · `docs/product/screen-inventory.md` § Amendment C (the Figma-vs-spec rule).
