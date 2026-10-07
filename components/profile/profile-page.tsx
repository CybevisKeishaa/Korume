import type { ProfileView } from "@/lib/profile/view";
import { Container } from "@/components/ui/container";
import { Link } from "@/lib/i18n/navigation";
import { useFormatter, useTranslations } from "@/lib/i18n";
import { buttonStyles } from "@/components/ui/button";
import { IdentityCard } from "./identity-card";
import { QuickStats } from "./quick-stats";
import { LearningJourney } from "./learning-journey";
import { FavoriteContent } from "./favorite-content";
import { PersonalGoal } from "./personal-goal";
import { KorumeshipCard } from "./korumeship-card";
import { TodaysMemoryCard } from "./todays-memory-card";
import { AchievementsCard } from "./achievements-card";

/**
 * DOM order is the reading order at every width: identity, stats, journey, Korumeship, memory, favorite,
 * goal, achievements. The 3-column rail is pure CSS placement (app/globals.css `.profile-*`).
 */
export function ProfilePage({ view }: { view: ProfileView }) {
  const t = useTranslations("profile");
  const format = useFormatter();
  const month = (iso: string) => format.dateTime(new Date(iso), { month: "long", year: "numeric" });
  return (
    <Container className="py-xl">
      <div className="profile-layout">
        <header className="mb-lg flex flex-wrap items-end justify-between gap-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-strong">{t("page.eyebrow")}</p>
            <h1 className="text-3xl font-bold">{t("page.title")}</h1>
          </div>
          <p className="text-sm text-muted-foreground">{t("page.since", { month: month(view.identity.accountCreatedAt) })}</p>
        </header>
        <div className="profile-grid">
          <div className="profile-rail">
            <IdentityCard
              identity={view.identity}
              variant="page"
              actions={<Link href="/profile/edit" className={`${buttonStyles({ variant: "primary", size: "md" })} w-full`}>{t("identity.edit")}</Link>}
            />
            <QuickStats stats={view.stats} />
          </div>
          <div className="profile-main">
            <LearningJourney items={view.journey} />
            {view.korumeship && (
              <div className="profile-pair">
                <KorumeshipCard since={view.korumeship.since} />
                {view.todaysMemory && <TodaysMemoryCard memory={view.todaysMemory} />}
              </div>
            )}
            <FavoriteContent sources={view.favoriteSources} />
            <PersonalGoal goal={view.identity.learningGoal} />
            <AchievementsCard achievements={view.achievements} />
          </div>
        </div>
      </div>
    </Container>
  );
}
