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
 * curve — a slow hull over two syllable groups with a little grain — chosen
 * because it reads as speech at 130px wide. It is NOT decoded audio, it is not
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
const WAVE_BARS = 56;
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
  return Math.max(0.18, hull * syllables * grain);
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
 * The Remember card's review schedule — a grid of day slots with the next two
 * reviews lit, as `346:6275` draws it.
 *
 * ⚠️ Not derived from SRS state (spec §13.2). `LIT_DOTS` is a fixed pair of
 * indices chosen to sit where the reference lights them; it is not a query,
 * not a projection, and must never become one. The card says "Review
 * Schedule" in its own text, so deleting this grid loses decoration only.
 *
 * `DOT_COLUMNS` is the single home for the column count: the track list is
 * built from it inline rather than restated as a `grid-cols-*` class that
 * could drift out of sync with `DOT_COUNT` (CLAUDE.md §6, "one fact, one
 * home"). It is a count, not a copied pixel.
 */
const DOT_COLUMNS = 5;
const DOT_ROWS = 3;
const DOT_COUNT = DOT_COLUMNS * DOT_ROWS;
/** Bottom row, right of centre — where the reference's two lit dots sit. */
const LIT_DOTS: readonly number[] = [12, 13];

export function ReviewDotGrid() {
  return (
    <div
      data-review-grid
      aria-hidden="true"
      className="grid w-full justify-items-center gap-2xs"
      style={{ gridTemplateColumns: `repeat(${DOT_COLUMNS}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: DOT_COUNT }, (_, i) => (
        <span
          key={i}
          data-review-dot
          data-review-dot-lit={LIT_DOTS.includes(i) ? "true" : undefined}
          className={cn(
            "h-xs w-xs rounded-full",
            LIT_DOTS.includes(i) ? "bg-primary" : "border border-muted-foreground/45 bg-card",
          )}
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
