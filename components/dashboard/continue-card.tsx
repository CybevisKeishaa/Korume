import { Link, useTranslations } from "@/lib/i18n";
import type { ContinueView } from "@/lib/data/dashboard/facts";
import { DashboardCard } from "./dashboard-card";
import Image from "next/image";
import { buttonStyles } from "@/components/ui/button";
import { DashboardIcon } from "./dashboard-icon";
import type enShadowing from "@/messages/en/shadowing.json";

type TaxonomyKey = `situations.${keyof typeof enShadowing.situations}` | `sources.${keyof typeof enShadowing.sources}`;

export function ContinueCard({ view, error = false }: { view: ContinueView; error?: boolean }) {
  const t = useTranslations("dashboard");
  const shadowing = useTranslations("shadowing");
  const eyebrow = t(`continue.eyebrow.${view.kind}`);
  if (error) return <DashboardCard id="continue-learning" area="continue" eyebrow={eyebrow}><p>{t("card.error")}</p></DashboardCard>;
  if (view.kind === "onboarding") return <DashboardCard id="continue-learning" area="continue" eyebrow={eyebrow}><p>{t("continue.onboarding")}</p><Link className={buttonStyles({ className: "dash-btn mt-[calc(20*var(--d))] self-start" })} href="/shadowing">{t("continue.cta.explore")}</Link></DashboardCard>;
  const placement = "placement" in view ? view.placement : null;
  const href = `/shadowing/${view.videoId}`;
  const primary = view.kind === "continue" ? t("continue.cta.continue") : t("continue.cta.start");
  const percent = view.kind === "continue" && view.percent !== null ? Math.min(100, view.percent) : null;
  // The lesson's cover sits behind the right side, softened and faded into the card so the text stays readable.
  const cover = view.thumbnailUrl ? <>
    <Image src={view.thumbnailUrl} alt="" fill sizes="(min-width: 1100px) 50vw, 100vw" className="scale-105 object-cover object-center opacity-60 blur-[2px]" />
    <div className="absolute inset-0 bg-gradient-to-r from-card via-card/90 to-card/40" />
  </> : undefined;
  return <DashboardCard id="continue-learning" area="continue" eyebrow={eyebrow} background={cover}>
    <div className="dashboard-continue-content">
      <p className="dash-display dash-title-lg line-clamp-2">{view.title}</p>
      {placement && <p className="dash-meta mt-[calc(8*var(--d))] text-muted-foreground">{placement.title} · {t("continue.lessonOrdinal", { position: placement.position })}</p>}
      {percent !== null && <progress className="dashboard-progress mt-[calc(24*var(--d))]" aria-label={t("continue.percent", { percent })} value={percent} max={100} />}
      <div className="dash-small mt-[calc(12*var(--d))] flex flex-wrap gap-x-[calc(20*var(--d))] text-muted-foreground">
        {percent !== null && <p>{t("continue.percent", { percent })}</p>}
        {view.kind === "continue" && view.remainingMinutes !== null && <p>{t("continue.remaining", { minutes: view.remainingMinutes })}</p>}
      </div>
      <div className="mt-[calc(28*var(--d))] flex flex-wrap gap-[calc(12*var(--d))]">
        <Link className={buttonStyles({ className: "dash-btn" })} href={href}><DashboardIcon name="play" />{primary}</Link>
        {view.kind === "continue" && <Link className={buttonStyles({ variant: "secondary", className: "dash-btn font-semibold" })} href={`${href}/summary`}>{t("continue.cta.review")}</Link>}
      </div>
      {view.kind === "continue" && view.tags.length > 0 && <ul className="mt-[calc(20*var(--d))] flex flex-wrap gap-[calc(8*var(--d))]">{view.tags.map((tag) => <li className="dashboard-chip" key={`${tag.kind}:${tag.value}`}>{tag.kind === "jlpt" ? tag.value : shadowing(`${tag.kind}.${tag.value}` as TaxonomyKey)}</li>)}</ul>}
    </div>
  </DashboardCard>;
}
