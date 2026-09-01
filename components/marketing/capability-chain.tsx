import Image from "next/image";
import { getTranslations } from "@/lib/i18n/server";
import { Section } from "./section";
import { ChainIcon, type ChainIconKey } from "./capability-chain-icon";
import type { Translator } from "./translator";

/**
 * §6 (spec §4, §8.2.2, §13).
 *
 * ## Composition — a centred statement over one threaded row (T9-R1)
 *
 * Measured off `346:6275` (the whole-page export; §6 is the band at y≈1240-1420
 * of 1821), this section is NOT the rail split §2-§5 use. Its eyebrow and
 * heading are centred over a full-width row of eight nodes, with the companion
 * at the row's right end. So it takes `Section` WITHOUT `rail`, and centres the
 * head block itself.
 *
 * Reference geometry, converted onto our own container. The export is 864px
 * wide for a 1280px design (0.675), and `Container` gives us 1088 CSS px of
 * content against the design's 1216 (0.895):
 *
 *   node cell pitch   89 ref px -> 132 design -> ~118 CSS px  (built: ~114)
 *   icon tile         49-52x45  -> ~74 x 67   -> ~68 x 60     (built: ~75 x 64)
 *   companion         120 wide  -> 178        -> 159          (built: 160)
 *   caption measure   ~61       -> ~90        -> ~81          (built: ~98)
 *
 * The caption measure is the one deliberate over-run: `text-caption` is 12px
 * here regardless of how wide the page is, so a proportional 81px column would
 * break "Understand the characters deeply." into four lines where the reference
 * gets two. Sizing the measure to the TYPE rather than to the ratio is what
 * keeps the row reading as the reference's does.
 *
 * ⚠️ CORRECTED MEASUREMENT (fix round 1, I2). The icon tile row above used to
 * read "61 x 45" — a number that was never actually sampled from the export
 * and was off by ~18%. A reviewer re-measured the reference tile at three
 * scanlines: 49-52 x 45 export px, ratio ~1.13 (a rounded square, matching
 * what the brief said in prose the whole time), tile pitch 89. The tile is
 * `aspect-[7/6]` (ratio 1.167, the closest token-scale-free fraction to 1.13)
 * rather than the old `aspect-[4/3]` (1.33) — 4:3 was filling 75% of the cell
 * where the reference gives the tile 58%, which is why the dashed run between
 * tiles read cramped. See `ChainNode`'s tile `span` for the corrected class.
 *
 * ## Two connector layers, not one (T9-R5)
 *
 * The reference draws the thread twice, and both are in `[data-connector]`:
 *
 *  A. a dashed segment between adjacent tiles at tile mid-height, with a small
 *     diamond at its midpoint — measured at ref y≈1336, colour ≈ rgb(36,39,44),
 *     i.e. `--border`, not the accent;
 *  B. a dashed rail BELOW the captions carrying one amber dot under each node —
 *     measured at ref y≈1407, dots sampled at rgb(252,229,158), i.e. a bloomed
 *     `--primary`.
 *
 * ⚠️ WHAT THEY DO WHEN THE GRID WRAPS. Eight nodes are one row only at `xl`;
 * below that the grid is 4 columns and then 2. A single full-width line drawn
 * across a wrapped grid is a defect, so neither layer is one:
 *
 *  - layer B is built PER NODE — each cell contributes its own rail segment, and
 *    the segments abut (the grid has no column gap; the horizontal breathing
 *    room is padding INSIDE each cell) so a row reads as one continuous rail.
 *    Wrapping therefore redraws the rail per row for free, with its own dots.
 *  - layer A is `hidden xl:flex`. It spans from one node's centre to the NEXT
 *    node's centre, which is only meaningful while the two are side by side; on
 *    a wrapped grid the last cell of each row would draw a segment off the edge
 *    of the grid — an overflow, and a WCAG 1.4.10 hazard. Hiding is the honest
 *    degradation; redrawing it per row is not expressible in CSS without
 *    container queries, because "last in this visual row" is not a selector.
 *
 * Both layers are decoration: the order the thread expresses is already the
 * reading order of the list, so every connector is `aria-hidden`, focus-free
 * and textless (there is a test).
 *
 * ## NO MOTION (T9-R9)
 *
 * This is the static half of spec §13; the whole-page motion pass is a later
 * task. Nothing here declares a transition, keyframe or scroll trigger, so this
 * section's `prefers-reduced-motion` obligation is satisfied vacuously — as
 * §2's, §3's, §4's and §5's are.
 *
 * Looks up the translator once and passes it down as a prop — see
 * `translator.ts` (task 4 fix F5) — rather than each subcomponent calling
 * `getTranslations` itself.
 */
const NODES: readonly ChainIconKey[] = [
  "video",
  "shadowing",
  "kanji",
  "vocabulary",
  "grammar",
  "jlpt",
  "conversation",
  "memory",
] as const;

/**
 * Centres the head block, and drops the heading from `text-display` (40px) to
 * `text-title` (28px).
 *
 * Both are overrides of `Section`'s unsplit branch, and both are measured, not
 * taste. `Section` left-aligns and hardcodes `text-display` for an unsplit `h2`
 * — §6 is the FIRST section on this page not to pass `rail`, so that branch has
 * never actually rendered here. The reference and the frame agree on the size:
 * frame node `347:6842` is a 592x38 text box, i.e. ~30px type on a 1216px
 * content width, which is ~27 CSS px once scaled onto our 1088. `text-title`
 * (28px) is the token that lands on it; `text-display` would be 49% larger than
 * the design asks for, and an oversized heading is the exact root cause §13
 * named for the compositions the user rejected in §2/§3/§4.
 *
 * `mx-auto` is needed alongside `text-center` because `Section` also puts
 * `max-w-3xl` on the unsplit heading: without it the h2's 768px box stays
 * pinned to the left of a 1088px column and the "centred" text lands ~160px
 * left of the page's centre. `[&_h2]` is safe as a selector because `Section`
 * renders exactly one heading and this section adds none.
 */
const CENTRED_HEAD = "text-center [&_h2]:mx-auto [&_h2]:text-title";

/**
 * The companion at the end of the chain (T9-R2/R3/R4).
 *
 * ⚠️ Do NOT reach for `mix-blend-screen`, and do NOT use `public/mascot/renders/`
 * — the first is a retired workaround for cut-outs with no alpha (there is a
 * test in `pitch-showcase.test.tsx` asserting the class never returns), the
 * second the user rejected on 2026-08-27. This is a real-alpha pose from the
 * hand-cut library the project owner supplied, recorded in
 * `scripts/mascot/poses.json` with `"slot": "chain"`.
 *
 * Why THIS pose: the pose has to make `chain.mascotAlt` TRUE, and that string
 * is copy the user owns — it was rewritten underneath this task while it was
 * being built (from "…seated on a glowing orb" to "…sitting quietly on a
 * glowing memory orb"). Both wordings say the companion is sitting ON an orb,
 * so that is the constraint the pose has to satisfy, not either exact phrasing.
 *
 * Both orb poses in the supplied library were opened and compared against the
 * reference crop rather than trusted from their `depicts` line (those strings
 * had a measured 5-in-27 error rate before a fix round). `reading-on-the-orb.png`
 * is the companion sitting on top of a glowing ringed orb inscribed with
 * Japanese characters, a scroll across its chest, eyes open, tail sweeping right
 * and a small ringed orb floating beside its head — the reference's mascot
 * detail for detail. `hugging-an-orb.png` also sits on a ringed orb but has its
 * eyes closed and no floating side-orb, so it matches the reference less well.
 * `holding-memory.png` — which `poses.json` had earmarked for this slot —
 * cradles an orb while sitting on the GROUND, which both wordings of the alt
 * would describe falsely; its manifest entry is corrected to say so.
 */
export const MASCOT_POSE = "/mascot/poses/reading-on-the-orb.png";

/**
 * Rendered size of the companion, in CSS px, and the same reasoning
 * `pitch-showcase.tsx` records: an intrinsic element size is the escape Rule #0
 * itself points at, where a `w-[10rem]` class would not be. The file is
 * 499x500, so a square box keeps its aspect ratio to within a rounding step.
 *
 * 160 is the reference's own 120 export px carried onto our container (see the
 * table in the docblock above). It is not an overlap-clearance figure, because
 * NOTHING OVERLAPS HERE: at `xl` the companion is a flex sibling of the node
 * grid and takes its own column, so T9-R4's three-mechanism rule for an image
 * that breaks out of its box (edge fade + explicit z-order + pointer-events)
 * does not apply — there is no overlap to make safe. Below `xl` it drops under
 * the grid, centred, still in flow.
 */
const MASCOT_WIDTH = 160;
const MASCOT_HEIGHT = 160;
/**
 * The companion renders at a fixed `MASCOT_WIDTH` CSS px at every viewport — it
 * is a fixed-size decorative element, not a fluid one — so `sizes` is that
 * width, flat. DERIVED, never restated (CLAUDE.md §6 "one fact, one home"): a
 * literal `"160px"` here would be the same fact in a second hand-synced home,
 * and changing the width without it leaves the hint silently wrong while every
 * test stays green.
 */
export const MASCOT_SIZES = `${MASCOT_WIDTH}px`;

export async function CapabilityChain() {
  const t = await getTranslations("marketing");

  return (
    <Section
      id="chain"
      eyebrow={t("chain.eyebrow")}
      heading={t("chain.heading")}
      className={CENTRED_HEAD}
    >
      <div className="xl:flex xl:items-end xl:gap-md">
        {/* NO column gap, deliberately: the rail segments in each cell have to
            abut for a row to read as one continuous line (see the docblock).
            The horizontal breathing room lives inside each cell instead.
            `min-w-0` because at `xl` this is a flex item, and below `xl` it is
            a grid whose implicit tracks would otherwise take a content-based
            minimum — the same hazard `Section` documents for its own split. */}
        <ul className="grid min-w-0 grid-cols-2 gap-y-xl sm:grid-cols-4 xl:flex-1 xl:grid-cols-8">
          {NODES.map((node, index) => (
            <ChainNode key={node} t={t} node={node} isLast={index === NODES.length - 1} />
          ))}
        </ul>

        <Companion t={t} />
      </div>
    </Section>
  );
}

/**
 * One capability: the icon tile, the name, the caption, and this cell's share
 * of both connector layers.
 *
 * `flex flex-col` with the rail on `mt-auto` is what keeps the rail STRAIGHT
 * across a row. Grid items stretch to their row's height by default, and the
 * captions are two lines in some cells and three in others; without `mt-auto`
 * each rail segment would sit at its own cell's natural bottom and the row
 * would draw a staircase. The `pb-md` above it is the minimum gap the reference
 * leaves under the caption (~13 export px), so the rail never touches the text
 * in the tallest cell of a row, where `mt-auto` has no slack to give.
 *
 * ⚠️ The NAME gets the whole cell width and the CAPTION is the one that is
 * inset. That asymmetry is measured, not accidental: at `xl` the cell is 114
 * CSS px and the longest name renders at 115, so an inset name wraps where the
 * reference keeps one line. The names are centred and short enough that they
 * never collide in practice; the caption is the run of text that actually needs
 * a gutter, and it has one.
 *
 * A name too long for its cell wraps rather than being made to fit. This is
 * deliberate — the alternative is tuning the mascot's width or the grid gap
 * until one specific string clears by a pixel, which encodes copy into geometry
 * and breaks on the next copy edit. `text-balance` splits such a name evenly
 * instead of leaving one orphaned word.
 */
function ChainNode({
  t,
  node,
  isLast,
}: {
  t: Translator;
  node: ChainIconKey;
  isLast: boolean;
}) {
  return (
    <li data-chain-node={node} className="flex min-w-0 flex-col">
      {/* Full cell width (no padding here), so layer A can span exactly from
          this node's centre to the next node's centre. */}
      <div className="relative flex justify-center">
        {isLast ? null : <TileThread />}
        {/* `relative` puts the tile in the same positioned flow as the thread
            and later in DOM order, so its opaque `bg-card` paints OVER the
            dashes crossing behind it — which is how the reference's segments
            appear only in the gaps between tiles. */}
        <span className="relative flex aspect-[7/6] h-3xl shrink-0 items-center justify-center rounded-md border border-border bg-card">
          <ChainIcon node={node} className="h-lg w-lg text-primary-strong" />
        </span>
      </div>

      <div className="pb-md">
        <p className="mt-xs text-balance text-body font-medium">{t(`chain.nodes.${node}.name`)}</p>
        <p data-chain-caption className="mt-2xs px-xs text-caption text-muted-foreground">
          {t(`chain.nodes.${node}.caption`)}
        </p>
      </div>

      <Rail />
    </li>
  );
}

/**
 * Connector layer A — the dashed run between this tile and the next one, with
 * the reference's small diamond at its midpoint.
 *
 * `left-1/2 w-full` spans one cell width starting at this cell's centre, which
 * IS the next cell's centre because the grid has no column gap and every track
 * is `1fr`. `top-1/2 -translate-y-1/2` centres it on the tile, derived from the
 * tile's own rendered height rather than restating it as an offset.
 */
function TileThread() {
  return (
    <span
      data-connector
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 top-1/2 hidden w-full -translate-y-1/2 items-center gap-2xs xl:flex"
    >
      <span className="flex-1 border-t border-dashed border-border" />
      <span className="h-2xs w-2xs rotate-45 bg-primary/40" />
      <span className="flex-1 border-t border-dashed border-border" />
    </span>
  );
}

/**
 * Connector layer B — this cell's share of the rail under the captions, and the
 * amber dot the reference puts beneath every node.
 *
 * The line is a top BORDER on a zero-height block: it adds no node to the
 * accessibility tree, needs no catalog string, and spans the full cell so
 * neighbouring segments meet. The dot is `ring-4 ring-primary/10` rather than
 * an arbitrary coloured `shadow-[...]` (which Rule #0 forbids) — the reference
 * samples it as a bloomed accent, not a flat 4px square.
 */
function Rail() {
  return (
    <span
      data-connector
      aria-hidden="true"
      className="pointer-events-none relative mt-auto block border-t border-dashed border-border"
    >
      <span className="absolute left-1/2 top-0 h-2xs w-2xs -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-4 ring-primary/10" />
    </span>
  );
}

/**
 * The companion, at the END of the row rather than in a block beneath it
 * (T9-R4) — in the reference it reads as the chain's terminus, standing about
 * two and a half tiles tall with its orb sitting on the rail's line.
 *
 * `xl:items-end` on the parent is what puts the orb on the rail: the grid and
 * this column share a bottom edge, and the grid's bottom edge IS the rail.
 *
 * The alt is the catalog's own `chain.mascotAlt`, not `""`. §4's companion is
 * hidden from assistive tech because the card beside it already says
 * "Companion" in text; here the catalog supplies a description and nothing else
 * on the page names the character, so the description is worth announcing.
 */
function Companion({ t }: { t: Translator }) {
  return (
    <div className="mt-lg flex justify-center xl:mt-0 xl:block xl:shrink-0">
      <Image
        data-chain-mascot
        src={MASCOT_POSE}
        alt={t("chain.mascotAlt")}
        width={MASCOT_WIDTH}
        height={MASCOT_HEIGHT}
        sizes={MASCOT_SIZES}
      />
    </div>
  );
}
