import { Link, useTranslations } from "@/lib/i18n";
import type { ContinueView } from "@/lib/data/dashboard/facts";
import { DashboardCard } from "./dashboard-card";
import Image from "next/image";
import { buttonStyles } from "@/components/ui/button";
import type enShadowing from "@/messages/en/shadowing.json";

type TaxonomyKey = `situations.${keyof typeof enShadowing.situations}` | `sources.${keyof typeof enShadowing.sources}`;

export function ContinueCard({ view, error = false }: { view: ContinueView; error?: boolean }) {
  const t = useTranslations("dashboard");
  const shadowing = useTranslations("shadowing");
  const eyebrow = t(`continue.eyebrow.${view.kind}`);
  if (error) return <DashboardCard id="continue-learning" area="continue" eyebrow={eyebrow}><p>{t("card.error")}</p></DashboardCard>;
  if (view.kind === "onboarding") return <DashboardCard id="continue-learning" area="continue" eyebrow={eyebrow}><p>{t("continue.onboarding")}</p><Link className={buttonStyles({ className: "mt-md rounded-full" })} href="/shadowing">{t("continue.cta.explore")}</Link></DashboardCard>;
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
    <p className="text-title font-semibold leading-tight">{view.title}</p>
    {placement && <p className="text-sm text-muted-foreground">{placement.title} · {t("continue.lessonOrdinal", { position: placement.position })}</p>}
    {percent !== null && <progress className="dashboard-progress mt-md" aria-label={t("continue.percent", { percent })} value={percent} max={100} />}
    <div className="mt-xs flex flex-wrap gap-x-md text-sm text-muted-foreground">
      {percent !== null && <p>{t("continue.percent", { percent })}</p>}
      {view.kind === "continue" && view.remainingMinutes !== null && <p>{t("continue.remaining", { minutes: view.remainingMinutes })}</p>}
    </div>
    <div className="mt-md flex flex-wrap gap-sm"><Link className={buttonStyles({ className: "rounded-full" })} href={href}>{primary}</Link>{view.kind === "continue" && <Link className={buttonStyles({ variant: "secondary", className: "rounded-full" })} href={`${href}/summary`}>{t("continue.cta.review")}</Link>}</div>
    {view.kind === "continue" && view.tags.length > 0 && <ul className="mt-md flex flex-wrap gap-xs text-xs text-muted-foreground">{view.tags.map((tag) => <li className="rounded-full border border-border px-sm py-2xs" key={`${tag.kind}:${tag.value}`}>{tag.kind === "jlpt" ? tag.value : shadowing(`${tag.kind}.${tag.value}` as TaxonomyKey)}</li>)}</ul>}
  </DashboardCard>;
}
