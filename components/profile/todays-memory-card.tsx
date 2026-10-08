import { Link } from "@/lib/i18n/navigation";
import { useFormatter, useTranslations } from "@/lib/i18n";
import type { ProfileView } from "@/lib/profile/view";
import { CARD_WARM, EYEBROW, LINK } from "./card-styles";

export function TodaysMemoryCard({ memory }: { memory: NonNullable<ProfileView["todaysMemory"]> }) {
  const t = useTranslations("profile");
  const format = useFormatter();
  return (
    <section className={CARD_WARM} aria-labelledby="profile-memory">
      <h2 id="profile-memory" className={EYEBROW}>{t("memory.eyebrow")}</h2>
      <p className="mt-sm text-sm text-muted-foreground">
        {format.dateTime(new Date(memory.occurredAt), { day: "numeric", month: "long", year: "numeric" })}
      </p>
      {memory.lineTextJp ? (
        <p lang="ja" className="mt-sm text-2xl [overflow-wrap:anywhere]">{memory.lineTextJp}</p>
      ) : memory.title ? (
        <p className="mt-sm text-lg [overflow-wrap:anywhere]">{memory.title}</p>
      ) : null}
      <p className="mt-sm text-xs text-muted-foreground">{t("memory.caption")}</p>
      <Link href="/journal" className={`${LINK} mt-sm inline-block`}>{t("memory.open")} <span aria-hidden="true">→</span></Link>
    </section>
  );
}
