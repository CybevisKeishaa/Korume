import { cn } from "@/lib/utils";

/**
 * §3's decorative miniatures — the small pieces of depicted product UI that
 * make each step card carry its own weight (spec §13.1.2).
 *
 * ⚠️ EVERY export here is DECORATION (spec §4.1, §13.2). Nothing is derived
 * from user state, SRS data, real audio or the difficulty engine; nothing is
 * clickable or focusable; every one carries `aria-hidden="true"` (and
 * `focusable="false"` where it is an `<svg>`, for IE/older-AT tab behaviour).
 * Delete the whole file and §3 loses decoration and no meaning — each card's
 * content stays in its own visible text, which is why none of these needs a
 * catalog string.
 *
 * They are split out of `journey.tsx` because that file had already reached
 * the size CLAUDE.md §6 caps, and because "how the depicted UI is drawn" is a
 * second responsibility from "what the five steps are".
 *
 * NO MOTION. This is the static half of spec §13; the whole-page motion pass
 * is a later task. Nothing here declares a transition, keyframe or trigger.
 */

/* ------------------------------------------------------------------ arrow */

/**
 * The connector between two adjacent step cards. The only connector shared
 * across multiple call sites in the whole port (spec §4) — §2's constellation
 * and §6's chain are each used once and stay inline.
 *
 * Was the literal character `→`, which renders in whatever the body face
 * happens to draw: a heavy, wide, baseline-sat glyph the reference does not
 * match. `346:6275` draws a thin short shaft closing on a small chevron head,
 * at the cards' vertical middle. Stroked geometry gets that, and gets it at
 * the same weight as §2's connectors (`strokeWidth={1}`) so the page's
 * linework reads as one hand.
 */
const ARROW_VIEW = "0 0 16 12";

export function StepArrow() {
  return (
    <svg
      data-step-arrow
      aria-hidden="true"
      focusable="false"
      viewBox={ARROW_VIEW}
      // `h-sm w-sm`, not `h-3 w-3`: `theme.extend.spacing` EXTENDS Tailwind's
      // default numeric scale, so `h-3` is hardcoded rem the Rule #0 scan
      // cannot see (hero-video-card.tsx carries the same note).
      className="h-sm w-sm shrink-0 text-primary-strong"
    >
      <path
        d="M2 6 H12 M8.5 2.5 L12 6 L8.5 9.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ------------------------------------------------- card 1: player chrome */

/**
 * Play glyph and progress track drawn over the Watch card's photograph.
 *
 * Depicts, never functions (spec §2.3): no control here is focusable or
 * clickable, and no timestamp text is invented. Three properties make an
 * overlay on a photograph safe, and all three are load-bearing — the same set
 * `problem.tsx` documents for §2's photograph:
 *
 *  1. `pointer-events-none` on both layers, so a decoration with nothing to
 *     click can never intercept a pointer.
 *  2. Painting order: both layers are absolute children of the same
 *     `relative` wrapper and come AFTER the image in the subtree, so they
 *     paint above it with no `z-index` to keep in sync.
 *  3. Their own dark ground. The treatment has to hold over an ARBITRARY
 *     photograph, not just this daylit street: the glyph sits on a scrim
 *     disc and the track on a bottom-up scrim ramp, and the track's unplayed
 *     half is drawn from the foreground ramp at partial alpha rather than
 *     `--border` (a near-black hairline meant for `--card`), so it stays a
 *     light hairline whatever is behind it. This is `hero-video-card.tsx`'s
 *     fix F9 applied to a second surface, not a new invention.
 */
/** How far through the depicted clip the track is drawn. A proportion, not a time. */
const WATCH_PROGRESS = "38%";

export function WatchPlayGlyph() {
  return (
    <div
      data-watch-play
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      <span className="flex h-lg w-lg items-center justify-center rounded-full border border-foreground/30 bg-scrim/55">
        <svg viewBox="0 0 12 12" focusable="false" className="h-xs w-xs text-foreground">
          {/* Optically centred: a triangle's visual centre sits left of its
              bounding box's, so the box is nudged right inside the disc. */}
          <path d="M4 2 L10.5 6 L4 10 Z" fill="currentColor" />
        </svg>
      </span>
    </div>
  );
}

export function WatchProgress() {
  return (
    <div
      data-watch-progress
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-scrim/85 via-scrim/45 to-transparent px-2xs pb-2xs pt-lg"
    >
      {/* `bg-foreground/40`, not the default `bg-border`: see property (3). */}
      <StepProgressBar fill={WATCH_PROGRESS} track="bg-foreground/40" />
    </div>
  );
}

/* ------------------------------------------------------ card 1/2: hairline */

/**
 * The thin accent bar the reference runs along a panel's base — a position in
 * a clip or a transcript, not a measurement of anything. One home for both
 * call sites so the Watch card's chrome and the Understand card's base read as
 * the same element; `track` exists only because one of them sits over a
 * photograph and the other over a panel (see `WatchPlayGlyph`, property 3).
 */
function StepProgressBar({ fill, track }: { fill: string; track?: string }) {
  return (
    <div data-step-progress aria-hidden="true" className={cn("h-px w-full", track ?? "bg-border")}>
      <div className="h-px bg-primary" style={{ width: fill }} />
    </div>
  );
}

/** The Understand card's base bar — how far the depicted transcript has played. */
const UNDERSTAND_PROGRESS = "42%";

export function UnderstandProgress() {
  return <StepProgressBar fill={UNDERSTAND_PROGRESS} />;
}

/* ------------------------------------------------------- card 3: waveform */

/**
 * The Shadow card's audio waveform.
 *
 * ⚠️ It draws AMPLITUDE, and that is deliberate (controller ruling,
 * 2026-08-29). An earlier version substituted a shrunken copy of §4's pitch
 * contour, arguing that the frame "draws a crude bar cluster where a waveform
 * belongs" and that bars misrepresent pitch. That argument is right for §4 —
 * pitch is a continuous quantity and bars do misrepresent it — and was
 * over-applied here. `346:6275`'s card-3 graphic is symmetric about a centre
 * line, which makes it an amplitude envelope, a different quantity; amplitude
 * bars are exactly what a shadowing recorder shows the user
 * (`components/video-player/waveform.tsx` draws the real one that way, from
 * a decoded `Blob`). Reusing the pitch contour at small scale also made §3 a
 * duplicate of §4, which is part of why the page read flat.
 *
 * ⚠️ This is ILLUSTRATION, not measurement. The envelope below is a hand-shaped
 * curve — a slow hull over two syllable groups with a little grain — shaped to
 * read as speech at the width this strip ACTUALLY renders at, which is 103.84
 * CSS px on a 1265px page. It once said "at 130px wide" and shipped at 103.84,
 * which is how 56 bars became a 1.02px smear; `WAVE_BARS` now records the
 * derivation. It is NOT decoded audio, it is not
 * derived from any recording, and nothing may ever wire it to one: the real
 * renderer is the client component named above. It carries no accessible name
 * for the same reason.
 *
 * Two-tone, split at a playhead, as the reference is. The reference paints the
 * recorded portion cyan; Korume's palette is deliberately single-accent
 * (`app/globals.css` — "the one accent"), so this uses the house pair that
 * `pitch-showcase.tsx` already established for "the marked line vs the rest":
 * `primary` against `muted-foreground`. Hue is the one reference property
 * this section cannot copy without inventing a colour token.
 */
const WAVE_WIDTH = 160;
const WAVE_HEIGHT = 52;
/**
 * 32, not the 56 this shipped with. The bar count is a function of the width
 * the strip ACTUALLY renders at, and that is 103.84 CSS px on a 1265px page —
 * not the 130px the envelope below was shaped for. 56 bars there is a 1.854px
 * pitch and a 1.02px bar, which at a 0.51px corner radius is a blurred capsule,
 * so the strip read as one orange smear. 32 gives a 3.245px pitch and a 1.78px
 * bar, which survives rasterisation at DPR 1.
 *
 * Re-derive it if the card's width ever changes: `floor(strip width / 3)`, the
 * pitch below which a `WAVE_BAR_DUTY` bar falls under ~1.7 CSS px.
 */
const WAVE_BARS = 32;
/** Where the playhead sits — the reference splits its waveform at ~62%. */
const WAVE_RECORDED_BARS = Math.round(WAVE_BARS * 0.62);
/** Gap between bars, as a share of the per-bar pitch. */
const WAVE_BAR_DUTY = 0.55;

/**
 * Hand-shaped speech-like envelope in 0..1. Deterministic; see the docblock.
 *
 * The hull is a fast-attack PLATEAU (`min(1, sin(pi t) * 4)`), not a bare
 * half-sine: a half-sine's tails go to zero, which left the last quarter of the
 * bars — exactly the unrecorded portion the two-tone split is meant to show —
 * flat against the centre line and invisible. Speech does not fade in and out
 * over a clip; it starts, runs, and stops.
 */
function waveAmplitude(index: number): number {
  const t = index / (WAVE_BARS - 1);
  const hull = Math.min(1, Math.sin(Math.PI * t) * 4) ** 0.8;
  const syllables = 0.5 + 0.5 * Math.sin(t * 17.4) * Math.sin(t * 5.3 + 0.4);
  const grain = 0.74 + 0.26 * Math.sin(t * 46.1 + 1.7);
  // 0.05, not the 0.18 this shipped with. The floor exists so the unrecorded
  // tail still draws a line instead of vanishing — but 0.18 of the half-height
  // is 6.07 CSS px against a 28.43px peak, a dynamic range of 4.7:1, and speech
  // does not look like that: it flattened the valleys the two-tone split exists
  // to show. The reference's own bar columns run ~33:1 (`ref/zoom-c3.png`, lit
  // column heights min 4 / max 132). 0.05 keeps a ~1.7px line in the valleys
  // and takes the range to ~17:1.
  return Math.max(0.05, hull * syllables * grain);
}

export function ShadowWaveform() {
  const pitch = WAVE_WIDTH / WAVE_BARS;
  const barWidth = pitch * WAVE_BAR_DUTY;
  const mid = WAVE_HEIGHT / 2;

  return (
    <svg
      data-shadow-waveform
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 ${WAVE_WIDTH} ${WAVE_HEIGHT}`}
      // No height class (Rule #0 — `h-8` would be a hardcoded rem): the
      // viewBox supplies the intrinsic aspect ratio, so `w-full` alone scales
      // the height proportionally, as `pitch-showcase.tsx`'s chart does.
      className="w-full"
    >
      {Array.from({ length: WAVE_BARS }, (_, i) => {
        const half = waveAmplitude(i) * mid;
        const recorded = i < WAVE_RECORDED_BARS;
        return (
          <rect
            key={i}
            data-wave-bar
            // The two-tone split as DATA rather than only as a colour, so the
            // guard reads the split instead of a class name (and so that
            // WCAG 1.4.1 has a non-colour hook if this ever gains a label).
            data-wave-state={recorded ? "recorded" : "rest"}
            x={i * pitch + (pitch - barWidth) / 2}
            y={mid - half}
            width={barWidth}
            height={half * 2}
            rx={barWidth / 2}
            className={recorded ? "fill-primary" : "fill-muted-foreground/45"}
          />
        );
      })}
    </svg>
  );
}

/** The record affordance under the waveform. A glyph, not a button. */
export function RecordGlyph() {
  return (
    <span
      data-record-glyph
      aria-hidden="true"
      className="flex h-md-lg w-md-lg items-center justify-center rounded-full border border-primary/40 bg-primary/10"
    >
      <span className="h-2xs w-2xs rounded-full bg-primary" />
    </span>
  );
}

/* ----------------------------------------------------------- card 4: save */

/** The third chip on the Mine card: a save affordance, drawn rather than named. */
export function SaveGlyph() {
  return (
    <svg
      data-save-glyph
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 12 12"
      className="h-sm w-sm text-muted-foreground"
    >
      <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth={1} />
      <path
        d="M6 3.75 V8.25 M3.75 6 H8.25"
        fill="none"
        stroke="currentColor"
        strokeWidth={1}
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ------------------------------------------------------- card 5: dot grid */

/**
 * The Remember card's review schedule — a grid of day slots, most of them
 * scheduled, two of them due, as `346:6275` draws it.
 *
 * ⚠️ Not derived from SRS state (spec §13.2). `DOT_MASK` is a fixed picture; it
 * is not a query, not a projection, and must never become one. The card says
 * "Review Schedule" in its own text, so deleting this grid loses decoration
 * only.
 *
 * ## The shape is read off the reference, not off prose (task A2 review I2)
 *
 * The brief's prose said "5 columns x 3 rows, two lit orange" and the first
 * build shipped a uniform 5 x 3 matrix of fifteen identical rings. That prose
 * was wrong, and the uniformity was the worse half of the error: every cell the
 * same reads as decorative wallpaper, not as a schedule with data in it — which
 * is exactly the "correct but lifeless" symptom §3 was rebuilt to remove.
 *
 * `zoom-c5.png` is the binding authority and was pixel-probed rather than
 * eyeballed (cell centres against the panel ground at RGB ~14,17,24):
 *
 *     row 1   .  *  .  *  *  *
 *     row 2   o  *  o  *  *  *
 *     row 3   o  *  o  @  @  .
 *
 * SIX columns, and the fill is sparse and irregular: 9 rings, 4 barely-visible
 * ghosts, 2 solid lit cells adjacent toward the bottom right, 3 cells empty.
 * The two lit cells are the only saturated marks in the card, which is what
 * makes "two reviews are due" read at a glance.
 *
 * The reference sets six tiny column labels over the dots. They are TEXT and
 * the copy catalog is frozen, so they ship as decorative tick marks instead —
 * one per column, generated from `DOT_COLUMNS`, needing no string.
 *
 * Two constants, no third. `DOT_COLUMNS` is the single home for the column
 * count — the track list is built from it inline rather than restated as a
 * `grid-cols-*` class that could drift (CLAUDE.md §6, "one fact, one home") —
 * and `DOT_MASK` is the single home for the fill. The ROW count is neither
 * stored nor needed: it is `DOT_MASK.length / DOT_COLUMNS`, and the grid flows
 * it. `journey.test.tsx` pins the shape (18 cells over `repeat(6,`) and each
 * state's count, so a mask edit that loses a cell or flattens the irregularity
 * goes red rather than silently reflowing.
 */
const DOT_COLUMNS = 6;

/** `empty` draws nothing but still occupies its cell, which is what keeps the columns aligned. */
type DotState = "empty" | "ghost" | "ring" | "lit";

/** Row-major, 6 per row, transcribed from `zoom-c5.png`. See the docblock's diagram. */
const DOT_MASK: readonly DotState[] = [
  "empty", "ring", "empty", "ring", "ring", "ring",
  "ghost", "ring", "ghost", "ring", "ring", "ring",
  "ghost", "ring", "ghost", "lit", "lit", "empty",
];

/**
 * `border-muted-foreground/45` for a ring, not `border-border`: `--border` is a
 * near-black hairline meant for `--card`, and these sit on `--muted`, where it
 * is invisible (fix round 2 of the original task). A ghost is a fill with no
 * ring at all — the reference's unfilled slots read as a faint disc, roughly
 * one stop above the panel ground, not as a fainter ring.
 */
const DOT_STATE_STYLES: Record<DotState, string> = {
  empty: "",
  ghost: "bg-muted-foreground/10",
  ring: "border border-muted-foreground/45 bg-card",
  lit: "bg-primary",
};

export function ReviewDotGrid() {
  return (
    <div
      data-review-grid
      aria-hidden="true"
      className="grid w-full justify-items-center gap-2xs"
      style={{ gridTemplateColumns: `repeat(${DOT_COLUMNS}, minmax(0, 1fr))` }}
    >
      {/* The column header, drawn rather than named — see the docblock. */}
      {Array.from({ length: DOT_COLUMNS }, (_, i) => (
        <span key={`tick-${i}`} data-review-tick className="h-px w-xs bg-muted-foreground/30" />
      ))}
      {DOT_MASK.map((state, i) => (
        <span
          key={i}
          data-review-dot
          data-review-dot-state={state}
          data-review-dot-lit={state === "lit" ? "true" : undefined}
          className={cn("h-xs w-xs rounded-full", DOT_STATE_STYLES[state])}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ rail button */

/** The small circled chevron the reference sets after the "See How It Works" label. */
export function CtaGlyph() {
  return (
    <svg
      data-cta-glyph
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 16 16"
      className="h-sm w-sm shrink-0 text-primary-strong"
    >
      <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth={1} />
      <path
        d="M6.75 5.5 L9.5 8 L6.75 10.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
