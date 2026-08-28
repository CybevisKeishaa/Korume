import Image from "next/image";
import { Link } from "@/lib/i18n/navigation";
import { getTranslations } from "@/lib/i18n/server";
import { buttonStyles } from "@/components/ui/button";
import { toPlotPoints } from "@/lib/pitch";
import type { PitchContour } from "@/lib/pitch";
import { NATIVE_DEMO_CONTOUR, USER_DEMO_CONTOUR, DEMO_REF_HZ } from "@/lib/marketing/pitch-demo";
import { Section } from "./section";
import { toPath } from "./contour-path";

/**
 * §4 (spec §7).
 *
 * ⚠️ The frame draws a BAR CHART here. Pitch is a continuous quantity, so bars do
 * not merely look worse — they misrepresent the product's headline differentiator
 * (CLAUDE.md §5 #1). The reference draws two overlaid contours, and it is right.
 *
 * "Same shape as the real one" is enforced by SHARED CODE: the points below come
 * from `toPlotPoints`, the identical function `components/video-player/
 * pitch-contour.tsx` uses on real recorded audio. If the real renderer's plotting
 * changes, this changes with it. Do not reimplement the mapping here.
 */
const VIEWBOX_WIDTH = 600;
const VIEWBOX_HEIGHT = 160;
/** Dash pattern shared by the native contour and its legend swatch (fix round 1, F3). */
const NATIVE_DASH = "10 6";
/** Internal coordinate system for the legend line swatches (not a CSS px/rem literal — see VIEWBOX_WIDTH). */
const SWATCH_VIEW_WIDTH = 24;
const SWATCH_VIEW_HEIGHT = 8;

function contourPath(contour: PitchContour): string {
  const { points } = toPlotPoints(contour, DEMO_REF_HZ, VIEWBOX_WIDTH, VIEWBOX_HEIGHT);
  return toPath(points);
}

const SUB_SCORES = ["pitch", "rhythm", "pronunciation", "timing"] as const;

/**
 * A small line icon next to a legend label (fix round 1, F3, WCAG 1.4.1):
 * the two contours must be distinguishable by more than colour alone. Mirrors
 * `components/video-player/pitch-contour-overlay.tsx`, which dashes the
 * reference stroke and keeps the user stroke solid — this reuses that same
 * convention rather than inventing a new one. `stroke-current` inherits the
 * colour from the parent `<span>`'s text colour class, so the swatch and its
 * label never fall out of sync.
 */
function LegendSwatch({ dashed }: { dashed: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${SWATCH_VIEW_WIDTH} ${SWATCH_VIEW_HEIGHT}`}
      className="h-2xs w-lg"
      preserveAspectRatio="none"
    >
      <line
        x1={0}
        y1={SWATCH_VIEW_HEIGHT / 2}
        x2={SWATCH_VIEW_WIDTH}
        y2={SWATCH_VIEW_HEIGHT / 2}
        className="stroke-current"
        strokeWidth={2}
        strokeDasharray={dashed ? NATIVE_DASH : undefined}
      />
    </svg>
  );
}

export async function PitchShowcase() {
  const t = await getTranslations("marketing");
  const nativePath = contourPath(NATIVE_DEMO_CONTOUR);
  const userPath = contourPath(USER_DEMO_CONTOUR);

  return (
    <Section id="pitch" eyebrow={t("pitch.eyebrow")} heading={t("pitch.heading")}>
      <div className="grid gap-xl lg:grid-cols-[1fr_2fr]">
        <div>
          <p className="max-w-md text-body-lg text-muted-foreground">{t("pitch.body")}</p>
          <Link href="/shadowing" className={buttonStyles({ variant: "outline", className: "mt-lg" })}>
            {t("pitch.cta")}
          </Link>
        </div>

        <div className="rounded-lg border border-border bg-card p-lg">
          <div className="flex items-center gap-md text-caption">
            <span className="flex items-center gap-xs text-primary-strong">
              <LegendSwatch dashed />
              {t("pitch.legend.native")}
            </span>
            <span className="flex items-center gap-xs text-muted-foreground">
              <LegendSwatch dashed={false} />
              {t("pitch.legend.you")}
            </span>
          </div>

          <svg
            role="img"
            aria-label={t("pitch.chartLabel")}
            viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
            className="mt-sm w-full"
            preserveAspectRatio="none"
          >
            <path
              data-contour="native"
              d={nativePath}
              fill="none"
              className="stroke-primary-strong"
              strokeWidth={2}
              strokeDasharray={NATIVE_DASH}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              data-contour="you"
              d={userPath}
              fill="none"
              className="stroke-muted-foreground"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          <p className="mt-sm font-jp text-body-lg">{t("pitch.example.jp")}</p>

          <dl className="mt-lg grid grid-cols-2 gap-md sm:grid-cols-4">
            {SUB_SCORES.map((score) => (
              <div key={score} data-subscore={score}>
                <dt className="text-caption text-muted-foreground">{t(`pitch.scores.${score}.name`)}</dt>
                <dd className="text-heading font-semibold">{t(`pitch.scores.${score}.value`)}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-lg flex items-end justify-between gap-md">
            <div>
              <p className="text-caption text-muted-foreground">{t("pitch.scores.overallLabel")}</p>
              <p className="text-display font-bold">{t("pitch.scores.overall")}</p>
              <p className="text-body text-primary-strong">{t("pitch.scores.verdict")}</p>
            </div>
            <div className="flex items-center gap-sm rounded-lg border border-border bg-muted p-sm">
              <Image
                data-mascot
                src="/mascot/poses/noting.png"
                alt=""
                width={96}
                height={86}
                aria-hidden="true"
                // A fixed local decorative icon needs no on-demand resize/format
                // negotiation — `unoptimized` serves the file as-is instead of
                // routing it through the `/_next/image` optimizer.
                unoptimized
                /* This card is the companion commenting on your pitch, so the
                   pose is it writing down what it heard. It carries a real
                   alpha channel (`scripts/mascot/poses.json`), which replaces
                   the `mix-blend-screen` trick the earlier `Korume.png` needed:
                   that only ever composited correctly because the source was
                   cut out on pure black, and it constrained where the mascot
                   could be placed. */
              />
              <div>
                <p className="text-caption text-primary-strong">{t("pitch.companion.name")}</p>
                <p className="text-caption text-muted-foreground">{t("pitch.companion.body")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
