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
 *  - the player chrome over the still: a play glyph, an elapsed timestamp, a
 *    part-played progress track and four control glyphs (subtitles, repeat,
 *    volume, fullscreen), all `aria-hidden` and none of them focusable. The
 *    glyph row was added on the owner's 2026-09-03 ruling — see the comment
 *    at the chrome itself for what that ruling overturned and what it did
 *    not.
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
      data-hero-card
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
          {/* §1's interior sequencing (Task 5, ruling R11): the still, then the
              transport bar drawn over it (step 1 nests inside step 0, so their
              `reveal-fade` opacities compose — verified in a browser, not
              reasoned about), then the sentence rail, then the mascot. */}
          <div className="relative" data-hero-step style={{ "--hero-step": 0 } as React.CSSProperties}>
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
                ⚠️ THE "NO TIMESTAMP, NO CONTROLS" LINE ABOVE IS SUPERSEDED
                (owner ruling, 2026-09-03). It read the reference's four
                control glyphs as promises — draw a loop button and a visitor
                expects loop playback — so it drew a play glyph and a bare
                line and left the rest to a decision. The owner made it:
                "4 nút tùy bạn, trông sao cho đẹp, không cần mang tính hứa
                đâu, bởi vì tôi tin là màn luyện tập shadowing còn đặc sắc hơn
                nhiều." The glyphs are composition, not a feature list.

                What did NOT change: they are still depictions. The chrome is
                `aria-hidden`, `pointer-events-none`, and contains no `a`,
                `button`, `input` or `[tabindex]` — `hero.test.tsx` asserts
                all four, so a later task cannot quietly make one real.

                The four chosen are the ones whose silhouettes stay legible at
                12 px and whose meanings this page can stand behind anyway:
                subtitles (the card already shows a transcript), repeat (a
                shadowing loop), volume, fullscreen. Two outlined boxes and
                two round forms, so the row reads as a row rather than as four
                similar smudges. The play glyph stays solid — the primary
                affordance filled, the secondary ones outlined.

                The timestamp is `hero.video.elapsed`, a catalog string. It is
                "0:24" and shows ELAPSED ONLY: the total is already on screen
                as `hero.video.duration` four rows up, and a "0:24 / 13:00"
                readout would put the same fact in two places by hand
                (CLAUDE.md §6). 0:24 of 13 min is 3.1%, which is what the
                played segment below is set to, and it agrees with the rail's
                "Sentence 1 / 29" instead of contradicting it. */}
            <div
              data-player-chrome
              data-hero-step
              style={{ "--hero-step": 1 } as React.CSSProperties}
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-xs bg-gradient-to-t from-scrim/85 via-scrim/45 to-transparent px-sm pb-xs pt-xl"
            >
              {/* The track is a percentage, which Rule #0 allows and intends:
                  3% is a RELATIONSHIP to the duration beside it, not a copied
                  pixel. */}
              <div data-player-track className="h-px w-full bg-foreground/40">
                <div data-player-progress className="h-full w-[3%] bg-primary" />
              </div>

              <div className="flex items-center gap-sm">
                {/* `h-sm w-sm` is the same 0.75rem the old `h-3 w-3` resolved
                    to, said in tokens: `theme.extend.spacing` EXTENDS
                    Tailwind's numeric scale, so `h-3` was hardcoded rem the
                    Rule #0 scan cannot see. */}
                <svg viewBox="0 0 12 12" className="h-sm w-sm shrink-0 text-foreground">
                  <path d="M2 1.5 L10 6 L2 10.5 Z" fill="currentColor" />
                </svg>
                <span className="text-caption tabular-nums text-foreground/80">
                  {t("hero.video.elapsed")}
                </span>

                <span className="flex-1" />

                {/* Stroked, not filled, and drawn on the same 12x12 grid as
                    the play glyph so the row sits on one optical baseline. */}
                <svg
                  data-player-control="subtitles"
                  viewBox="0 0 12 12"
                  className="h-sm w-sm shrink-0 text-foreground/75"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeLinecap="round"
                >
                  <rect x="1" y="3" width="10" height="6" rx="1.5" />
                  <path d="M3.4 6.4h2M7 6.4h1.6" />
                </svg>
                <svg
                  data-player-control="repeat"
                  viewBox="0 0 12 12"
                  className="h-sm w-sm shrink-0 text-foreground/75"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M2 4.4h6.2" />
                  <path d="M6.9 3.1 8.2 4.4 6.9 5.7" />
                  <path d="M10 7.6H3.8" />
                  <path d="M5.1 6.3 3.8 7.6l1.3 1.3" />
                </svg>
                <svg
                  data-player-control="volume"
                  viewBox="0 0 12 12"
                  className="h-sm w-sm shrink-0 text-foreground/75"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M1.6 4.6h1.9L6 2.6v6.8L3.5 7.4H1.6z" />
                  <path d="M8.2 4.3a2.6 2.6 0 0 1 0 3.4" />
                </svg>
                <svg
                  data-player-control="fullscreen"
                  viewBox="0 0 12 12"
                  className="h-sm w-sm shrink-0 text-foreground/75"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M1.6 4.2V2.6a1 1 0 0 1 1-1h1.6" />
                  <path d="M7.8 1.6h1.6a1 1 0 0 1 1 1v1.6" />
                  <path d="M10.4 7.8v1.6a1 1 0 0 1-1 1H7.8" />
                  <path d="M4.2 10.4H2.6a1 1 0 0 1-1-1V7.8" />
                </svg>
              </div>
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
              data-hero-step
              style={{ "--hero-step": 3 } as React.CSSProperties}
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
