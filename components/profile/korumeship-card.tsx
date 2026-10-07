import { Link } from "@/lib/i18n/navigation";
import { useTranslations } from "@/lib/i18n";
import { MascotPose } from "@/components/mascot/mascot-pose";
import { CARD, EYEBROW, LINK } from "./card-styles";

/** Calendar parts of an instant in the study zone. */
function zonedParts(date: Date, timeZone: string): { y: number; m: number; d: number } {
  const get = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "numeric", day: "numeric" })
    .formatToParts(date);
  const n = (type: string) => Number(get.find((p) => p.type === type)?.value);
  return { y: n("year"), m: n("month"), d: n("day") };
}

/** Whole calendar months from `sinceIso` to now in `timeZone`, at least 1. */
export function wholeMonths(sinceIso: string, timeZone: string): number {
  const a = zonedParts(new Date(sinceIso), timeZone);
  const b = zonedParts(new Date(), timeZone);
  let m = (b.y - a.y) * 12 + (b.m - a.m);
  if (b.d < a.d) m -= 1;
  return Math.max(1, m);
}

export function KorumeshipCard({ since, timeZone }: { since: string | null; timeZone: string }) {
  const t = useTranslations("profile");
  return (
    <section className={CARD} aria-labelledby="profile-korume">
      <div className="mb-sm flex justify-center"><MascotPose pose="korumeship" size="md" /></div>
      <p className={EYEBROW}>{t("korume.eyebrow")}</p>
      <h2 id="profile-korume" className="mt-xs text-2xl font-bold">{t("korume.title")}</h2>
      <p className="mt-sm text-sm text-muted-foreground">
        {since ? t("korume.together", { months: wholeMonths(since, timeZone) }) : t("korume.fresh")}
      </p>
      <Link href="/korume/chat" className={`${LINK} mt-sm inline-block`}>{t("korume.open")} <span aria-hidden="true">▸</span></Link>
    </section>
  );
}
