import Image from "next/image";
import { Link } from "@/lib/i18n/navigation";
import { getTranslations } from "@/lib/i18n/server";
import { buttonStyles } from "@/components/ui/button";
import { Section } from "./section";
import { AssetSlot } from "./asset-slot";

/**
 * §8 — the page's call to action (spec §4, §13).
 *
 * ## Composition
 *
 * Measured off `346:6275` (§8 is the band at y≈1535-1700 of 1821): a full-bleed
 * night photograph of a lantern-lit bridge, with heading, body, two buttons and
 * a one-line note CENTRED over it, and the companion sitting at the right where
 * the centred column ends.
 *
 * It is a `Section` with `layout="centred"`, not the bespoke `<section>` the
 * plan drew. `Section` owns this page's vertical rhythm and its own docblock
 * forbids a section setting its own `py-*`; the plan's version did exactly that,
 * which would have put G4 back in nine places. Building §8 is also what settled
 * `Section`'s layout API — see that file.
 *
 * ## ⚠️ The scrim is a WCAG requirement, and its strength is measured
 *
 * `cta-bridge.png` is mostly very dark — median pixel luminance gives white text
 * 19.7:1 — but it is a photograph of LANTERNS, and their flames are near-white.
 * Measured over the file (sampling every second pixel): the 99th percentile of
 * luminance gives white text **2.28:1** and the maximum gives **1.00:1**, against
 * the 4.5:1 WCAG AA floor. Worse, the bright pixels are not confined to one
 * corner: split into a 6x4 grid, the whole bottom half runs 1.5-4.1:1. There is
 * no safe region to place text in, so "put the copy where the photo is dark" is
 * not available and the scrim is not optional.
 *
 * Sizing it, rather than guessing: compositing happens in sRGB space, so a scrim
 * of colour C at alpha a over a background channel B yields `a*C + (1-a)*B`. The
 * worst case is B = 255. `--background` is `#0b0d11`, whose largest channel is
 * 17, so at 70% the worst composited channel is `0.7*17 + 0.3*255 = 88.4`, whose
 * relative luminance is 0.0985 and whose contrast against white is **7.07:1** —
 * past AA with room, and close to the 7:1 AAA bar. At 60% it would be 4.95:1,
 * which passes but leaves nothing for JPEG ringing around a lantern.
 *
 * Using `--background` rather than pure black is deliberate: the scrim is the
 * page's own colour, so the band darkens toward the page instead of toward a
 * hole, and the reference's own backdrop measures ~20/255 — the same order as
 * what this produces over the photograph's dark areas.
 *
 * ⚠️ THE SCRIM ALONE WAS NOT ENOUGH, AND ONLY MEASURING THE RENDERED BAND
 * SHOWED IT. The arithmetic above is for WHITE text. The body and the note
 * were written with `text-muted-foreground` — correct on this page's flat
 * surfaces, and the token every other section uses for secondary copy — but
 * that grey has far less headroom. Replaying the real geometry (the band
 * renders 1265x314, so `object-cover` scales the file by 0.757 and shows source
 * rows 263-678 of 941) and sampling every pixel under each text box:
 *
 *              muted grey        --foreground
 *   heading         —              8.33:1
 *   body          3.75:1  FAIL    10.92:1
 *   note          2.41:1  FAIL     7.00:1
 *   outline CTA     —              7.36:1
 *
 * So §8's copy is `text-foreground`, and its hierarchy comes from size and
 * weight rather than colour. Raising the scrim instead was measured and
 * rejected: even at 80% the note only reaches 3.49:1, and the photograph would
 * be most of the way to a flat rectangle. Without any scrim at all every region
 * fails — the heading worst-case is 1.33:1.
 *
 * ⚠️ Do not "restore consistency" by putting `text-muted-foreground` back here.
 * `cta.test.tsx` fails if you do, and this is the reason.
 *
 * The per-region figures above are for the 1280 band. `object-cover` shows a
 * DIFFERENT crop of the file at every width — at 320 the band is 305x526, so it
 * shows a 546px-wide slice where 1280 shows the whole frame — so the result was
 * bounded rather than extrapolated: taking the brightest composited pixel
 * ANYWHERE in the band, which bounds any text placement in any locale,
 *
 *   305x526  6.85:1     753x314  6.86:1
 *   375x412  6.90:1    1008x314  6.86:1
 *   481x350  6.93:1    1265x314  6.82:1
 *
 * so the floor across every geometry is 6.82:1, against AA's 4.5:1.
 *
 * ## NO MOTION
 *
 * Static half of spec §13; the whole-page motion pass is task A-MOTION. What
 * this section will later want: the lanterns breathing, and the companion
 * settling as the band enters.
 */
export const CTA_BACKGROUND = "/marketing/cta-bridge.png";

/**
 * The companion, from the owner's supplied pose library (`scripts/mascot/poses.json`).
 *
 * `hugging-an-orb.png` is the only unused pose that is SITTING ON an orb, which
 * is what `cta.mascotAlt` — the owner's copy, and the binding description of
 * what we ship — says the image shows. `reading-on-the-orb.png` is the other
 * one and §6 already has it; `lying-prone.png` is lying, not sitting, so it
 * would make the alt text a lie for anyone who cannot see the image.
 *
 * ⚠️ It differs from `346:6275`, which draws eyes open on a ring-less orb. That
 * is accepted, not overlooked: the reference is a flattened PNG and our pose
 * library is a real asset the owner hand-cut, so the library wins on the same
 * reasoning the owner used to close §6's icon question. Do NOT re-source this
 * from `public/mascot/renders/` (Blender, rejected — spec §5.3), and do NOT
 * reach for `mix-blend-mode: screen`: the poses have real alpha, screening is
 * retired, and §4 and §6 already assert its absence.
 */
export const CTA_MASCOT = "/mascot/poses/hugging-an-orb.png";

/** See the docblock: 70% of `--background`, worst composited case 7.07:1. */
export const CTA_SCRIM = "bg-background/70";

/**
 * The background is the widest thing on the page — a true full-bleed band — so
 * it declares `100vw` and nothing narrower.
 */
const BACKGROUND_SIZES = "100vw";

/**
 * The companion renders at ~20% of the viewport from `lg` up and is hidden
 * below it, so the hint never promises more than the widest case.
 */
const MASCOT_SIZES = "(min-width: 1024px) 20vw, 1px";

export async function Cta() {
  const t = await getTranslations("marketing");

  return (
    <Section
      id="cta"
      heading={t("cta.heading")}
      layout="centred"
      className="overflow-hidden"
      backdrop={
        <>
          {/* Order is the mechanism: photograph, then scrim, then — because
              `Section`'s centred wrapper carries `relative z-10` — the copy on
              top of both. All three backdrop layers are `pointer-events-none`,
              since every one of them covers the two buttons. */}
          <AssetSlot
            ratio="16/9"
            description={t("cta.backgroundAlt")}
            src={CTA_BACKGROUND}
            sizes={BACKGROUND_SIZES}
            className="pointer-events-none absolute inset-0 aspect-auto rounded-none"
          />
          <div
            data-cta-scrim
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 ${CTA_SCRIM}`}
          />
          {/* Decorative: the companion repeats nothing the copy says, but it is
              a photograph-like figure rather than an icon, so it keeps a real
              alt string for anyone who wants to know what is there. Hidden below
              `lg`, where the centred column already fills the band and the
              figure would either overlap the buttons or shrink to a smudge.

              ⚠️ `right-[7%]`, not `right-0`. At `right-0` the pose's own tail
              runs to the viewport edge and reads as clipped — seen at 1280, not
              predicted. The reference sets the companion at x 640..800 of 864,
              leaving a 64px gap, i.e. 7.4% of the page; 7% puts it at 923..1176
              here, within 8px of the content column's own right edge. A
              proportion rather than a copied pixel, like §2's and §7's
              photographs. */}
          <Image
            data-mascot
            src={CTA_MASCOT}
            alt={t("cta.mascotAlt")}
            width={484}
            height={516}
            sizes={MASCOT_SIZES}
            className="pointer-events-none absolute bottom-0 right-[7%] hidden h-auto w-[20%] lg:block"
          />
        </>
      }
    >
      <p className="mx-auto max-w-xl text-body-lg text-foreground">{t("cta.body")}</p>

      <div className="mt-lg flex flex-wrap justify-center gap-sm">
        {/* One filled, one outlined. A page-level CTA that offers two equally
            weighted choices offers no choice at all, and the reference draws the
            same asymmetry. */}
        <Link href="/register" className={buttonStyles({ size: "lg" })}>
          {t("cta.primary")}
        </Link>
        <Link
          href="/shadowing/explore"
          className={buttonStyles({ size: "lg", variant: "outline" })}
        >
          {t("cta.secondary")}
        </Link>
      </div>

      <p className="mt-md text-caption text-foreground">{t("cta.note")}</p>
    </Section>
  );
}
