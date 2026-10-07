import { Link } from "@/lib/i18n/navigation";
import { useTranslations } from "@/lib/i18n";
import { MascotPose } from "@/components/mascot/mascot-pose";
import { CARD, EYEBROW, LINK } from "./card-styles";

/** Whole calendar months from `sinceIso` to now, at least 1. */
function wholeMonths(sinceIso: string): number {
  const a = new Date(sinceIso);
  const b = new Date();
  let m = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) m -= 1;
  return Math.max(1, m);
}

export function KorumeshipCard({ since }: { since: string | null }) {
  const t = useTranslations("profile");
  return (
    <section className={CARD} aria-labelledby="profile-korume">
      <div className="mb-sm flex justify-center"><MascotPose pose="korumeship" size="lg" /></div>
      <p className={EYEBROW}>{t("korume.eyebrow")}</p>
      <h2 id="profile-korume" className="mt-xs text-2xl font-bold">{t("korume.title")}</h2>
      <p className="mt-sm text-sm text-muted-foreground">
        {since ? t("korume.together", { months: wholeMonths(since) }) : t("korume.fresh")}
      </p>
      <Link href="/korume/chat" className={`${LINK} mt-sm inline-block`}>{t("korume.open")} <span aria-hidden="true">▸</span></Link>
    </section>
  );
}
