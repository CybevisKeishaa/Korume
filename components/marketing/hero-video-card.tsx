import Image from "next/image";
import type { Translator } from "./translator";
import { AssetSlot } from "./asset-slot";
import { HeroSentenceRail } from "./hero-sentence-rail";

/**
 * The hero's right-hand "app preview" card (spec §1, task 4 brief step 1).
 * Built to the reference's composition: header metadata, the still with
 * player chrome, transcript tabs over two transcript lines, a Companion
 * card, and the sentence rail (`HeroSentenceRail`) running alongside.
 *
 * Synchronous, taking the translator as a prop rather than calling
 * `getTranslations` itself — see `translator.ts` (task 4 fix F5).
 *
 * Still-to-rail proportion (task 4 fix F1): the frame holds still:rail at
 * ~495.5:255.8 ≈ 1.94:1. `lg:basis-2/3` here against `HeroSentenceRail`'s
 * `lg:basis-1/3` reproduces that as a 2:1 ratio — a relationship, not a
 * pixel, so no fixed-width token (`w-companion`, meant for the product's own
 * companion rail, not this depiction of it) is coupled in.
 *
 * Two affordances the reference depicts do not function on a marketing page
 * and ship as inert, non-focusable depictions rather than live controls
 * (spec §2.3 — no control with no real destination):
 *  - the Transcript / Japanese / English / Notes tabs: a static list with
 *    "Transcript" visually marked current. Making them real tabs would need
 *    per-tab content this catalog does not carry (only the transcript has
 *    real lines) and client-side state a server component can't own.
 *  - the player chrome over the still: an icon-only play glyph and a bare
 *    progress track, both `aria-hidden`. No timestamp text is invented.
 *
 * Ruling 4: the reference shows three transcript lines; the frame (347:6313)
 * carries only two text nodes (347:6405, 347:6408), and `hero.transcript.*`
 * — Task 1's catalog, derived from the frame — only has `lineOne`/`lineTwo`.
 * Two lines are built here, matching the catalog.
 */
export function HeroVideoCard({ t }: { t: Translator }) {
  return (
    <div
      role="group"
      aria-labelledby="hero-video-title"
      className="overflow-hidden rounded-lg border border-border bg-card"
    >
      <div className="flex items-center justify-between border-b border-border px-md py-sm">
        <p id="hero-video-title" className="text-caption text-foreground">
          {t("hero.video.title")}
        </p>
        <p className="text-caption text-muted-foreground">
          <span>{t("hero.video.level")}</span>
          <span aria-hidden="true"> · </span>
          <span>{t("hero.video.duration")}</span>
        </p>
      </div>

      <div className="flex flex-col lg:flex-row">
        <div className="flex min-w-0 flex-col lg:basis-2/3 lg:shrink-0">
          <div className="relative">
            {/* 1672x941 is exactly the 16/9 the slot declares, so filling it moved
                no layout (fix F7). Provenance recorded in `progress.md` per spec
                §5.2: user-generated from the written per-slot description. */}
            <AssetSlot
              ratio="16/9"
              description={t("hero.video.stillAlt")}
              src="/marketing/hero-still.png"
              priority
            />
            {/* Decorative player chrome — depicts, never functions (spec §2.3).
                Still `aria-hidden` and still not a control: fix F9 changes only
                how it is drawn.

                It used to carry NO scrim, and the stated reason was that a
                scrim would stop the slot reading as unmistakably pending (task
                4 fix F7). That reason expired with fix F7 itself: the slot now
                holds `hero-still.png`, a bright lantern-lit Kyoto street. A
                `bg-border` hairline and a bare glyph designed against a dark
                dashed placeholder read as a smudge over it.

                The treatment has to hold over an ARBITRARY photograph, not just
                this one, so it does not lean on the still's own tones:
                 - a bottom-up scrim ramp gives the chrome its own dark ground,
                   which is also what `347:6313` draws under its transport bar;
                 - the track is drawn from the foreground ramp at partial alpha
                   instead of `--border` (a near-black hairline meant for
                   `--card`), so it stays a light hairline whatever is behind it.
                No timestamp text is invented and no control becomes real —
                the crop and the transport bar's own fidelity are the
                visual-fidelity task's, not this one's. */}
            <div
              data-player-chrome
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-sm bg-gradient-to-t from-scrim/85 via-scrim/45 to-transparent px-sm pb-xs pt-xl"
            >
              {/* `h-sm w-sm` is the same 0.75rem the old `h-3 w-3` resolved to,
                  said in tokens: `theme.extend.spacing` EXTENDS Tailwind's
                  numeric scale, so `h-3` was hardcoded rem the Rule #0 scan
                  cannot see. */}
              <svg viewBox="0 0 12 12" className="h-sm w-sm shrink-0 text-foreground">
                <path d="M2 1.5 L10 6 L2 10.5 Z" fill="currentColor" />
              </svg>
              <div data-player-track className="h-px flex-1 bg-foreground/70" />
            </div>
          </div>

          <div className="border-b border-border px-md py-sm">
            <ul data-hero-tabs className="flex gap-md border-b border-border pb-xs text-caption">
              <li className="text-primary-strong">{t("hero.tabs.transcript")}</li>
              <li className="text-muted-foreground">{t("hero.tabs.japanese")}</li>
              <li className="text-muted-foreground">{t("hero.tabs.english")}</li>
              <li className="text-muted-foreground">{t("hero.tabs.notes")}</li>
            </ul>

            <div data-hero-transcript className="mt-xs flex flex-col gap-2xs">
              <p className="rounded-md border border-primary/25 bg-primary/10 px-sm py-xs font-jp text-caption text-foreground">
                {t("hero.transcript.lineOne")}
              </p>
              <p className="px-sm font-jp text-caption text-muted-foreground">
                {t("hero.transcript.lineTwo")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-xs px-md py-sm">
            {/* The reference puts the companion itself here, not an initial.
                `greeting.png` is its first appearance on the page, so the pose
                waves — see `scripts/mascot/poses.json` for the cut and the
                thread it starts. Intrinsic width/height do the sizing, so no
                numeric Tailwind size class is coupled in (Rule #0). */}
            <Image
              data-mascot
              src="/mascot/poses/greeting.png"
              alt=""
              width={44}
              height={60}
              aria-hidden="true"
              className="shrink-0"
              // A fixed local decorative asset needs no on-demand resize or
              // format negotiation; serve the file as-is.
              unoptimized
            />
            <p className="text-caption">
              <span className="text-primary-strong">{t("hero.companion.name")}</span>{" "}
              <span className="text-muted-foreground">{t("hero.companion.body")}</span>
            </p>
          </div>
        </div>

        <HeroSentenceRail t={t} />
      </div>
    </div>
  );
}
