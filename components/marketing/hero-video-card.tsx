import { getTranslations } from "@/lib/i18n/server";
import { AssetSlot } from "./asset-slot";
import { HeroSentenceRail } from "./hero-sentence-rail";

/**
 * The hero's right-hand "app preview" card (spec §1, task 4 brief step 1).
 * Built to the reference's composition: header metadata, the still with
 * player chrome, transcript tabs over two transcript lines, a Companion
 * card, and the sentence rail (`HeroSentenceRail`) running alongside.
 *
 * Two affordances the reference depicts do not function on a marketing page
 * and ship as inert, non-focusable depictions rather than live controls
 * (spec §2.3 — no control with no real destination):
 *  - the Transcript / Japanese / English / Notes tabs: a static row with
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
export async function HeroVideoCard() {
  const t = await getTranslations("marketing");
  // Awaited explicitly for the same reason `hero.tsx` awaits this
  // component's own promise — see that file's comment.
  const sentenceRail = await HeroSentenceRail();

  return (
    <div
      role="group"
      aria-label={t("hero.video.title")}
      className="overflow-hidden rounded-lg border border-border bg-card"
    >
      <div className="flex items-center justify-between border-b border-border px-md py-sm">
        <p className="text-caption text-foreground">{t("hero.video.title")}</p>
        <p className="flex gap-xs text-caption text-muted-foreground">
          <span>{t("hero.video.level")}</span>
          <span>{t("hero.video.duration")}</span>
        </p>
      </div>

      <div className="flex flex-col lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="relative">
            <AssetSlot ratio="16/9" description={t("hero.video.stillAlt")} priority />
            {/* Decorative player chrome — depicts, never functions (spec §2.3). */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-sm bg-gradient-to-t from-background/80 to-transparent px-sm py-xs"
            >
              <svg viewBox="0 0 12 12" className="h-3 w-3 text-foreground">
                <path d="M2 1.5 L10 6 L2 10.5 Z" fill="currentColor" />
              </svg>
              <div className="h-px flex-1 bg-border" />
            </div>
          </div>

          <div className="border-b border-border px-md py-sm">
            <div className="flex gap-md border-b border-border pb-xs text-caption">
              <span className="text-primary-strong">{t("hero.tabs.transcript")}</span>
              <span className="text-muted-foreground">{t("hero.tabs.japanese")}</span>
              <span className="text-muted-foreground">{t("hero.tabs.english")}</span>
              <span className="text-muted-foreground">{t("hero.tabs.notes")}</span>
            </div>

            <div className="mt-xs flex flex-col gap-2xs">
              <p className="rounded-md border border-primary/25 bg-primary/10 px-sm py-xs font-jp text-caption text-foreground">
                {t("hero.transcript.lineOne")}
              </p>
              <p className="px-sm font-jp text-caption text-muted-foreground">
                {t("hero.transcript.lineTwo")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-xs px-md py-sm">
            <span
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary-strong"
            >
              {t("hero.companion.name").slice(0, 1)}
            </span>
            <p className="text-caption">
              <span className="text-primary-strong">{t("hero.companion.name")}</span>{" "}
              <span className="text-muted-foreground">{t("hero.companion.body")}</span>
            </p>
          </div>
        </div>

        {sentenceRail}
      </div>
    </div>
  );
}
