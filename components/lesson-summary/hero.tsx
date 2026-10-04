import { buttonStyles } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n";
import { Link } from "@/lib/i18n/navigation";
import { areaProps } from "./area";

interface HeroProps {
  title: string;
  thumbnailUrl: string | null;
  completed: boolean;
  jlptLevel: string | null;
  sentenceCount: number;
  durationMinutes: number | null;
  replayHref: string;
  resumeHref: string;
}

/**
 * Spec §7.2 Hero. The thumbnail sits under a dark overlay so the text never lies on the bare image. The component
 * renders the two hrefs it is given; it computes none. The title is the header's `h1`, so here it is display text.
 */
export function Hero({ title, thumbnailUrl, completed, jlptLevel, sentenceCount, durationMinutes, replayHref, resumeHref }: HeroProps) {
  const t = useTranslations("shadowing.lessonSummary.hero");
  const meta = [
    jlptLevel,
    sentenceCount > 0 ? t("sentences", { count: sentenceCount }) : null,
    durationMinutes ? t("minutes", { minutes: durationMinutes }) : null,
  ].filter(Boolean).join(" · ");
  return (
    <section {...areaProps("hero")} aria-labelledby="summary-hero-eyebrow" className="relative isolate overflow-hidden rounded-lg border border-border bg-card">
      {thumbnailUrl && (
        <div aria-hidden className="absolute inset-0 -z-10 bg-cover bg-center" style={{ backgroundImage: `url(${JSON.stringify(thumbnailUrl)})` }} />
      )}
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-black/85 via-black/70 to-black/40" />
      <div className="flex min-h-48 flex-col justify-end gap-md p-lg text-white">
        <p id="summary-hero-eyebrow" className="text-caption font-semibold uppercase tracking-wide text-primary">
          {completed ? t("complete") : t("summary")}
        </p>
        <p className="text-title font-bold leading-tight">{title}</p>
        <div className="flex flex-wrap items-end justify-between gap-md">
          {meta && <p className="font-mono text-caption text-white/80">{meta}</p>}
          <div className="flex flex-wrap gap-sm">
            <Link href={replayHref} className={buttonStyles({ variant: "outline", size: "sm", className: "border-white/40 text-white hover:bg-white/10" })}>
              {t("replay")}
            </Link>
            <Link href={resumeHref} className={buttonStyles({ size: "sm" })}>{t("resume")}</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
