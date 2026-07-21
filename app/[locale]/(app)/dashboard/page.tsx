import { Suspense } from "react";
import { Link } from "@/lib/i18n/navigation";
import { getTranslations } from "@/lib/i18n/server";
import { Container } from "@/components/ui/container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LevelCard } from "@/components/learning/level-card";
import { StreakCard } from "@/components/learning/streak-card";
import { SrsDueCard } from "@/components/learning/srs-due-card";
import { BadgesGrid } from "@/components/learning/badges-grid";
import { RecommendationSection } from "@/components/learning/recommendation-section";
import { getUserStats } from "@/lib/data/user-stats";
import { vnDateString } from "@/lib/gamification";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  const statsResult = await getUserStats();
  const stats = statsResult.ok ? statsResult.data : null;
  const today = vnDateString(new Date());

  const MODULES = [
    { href: "/kanji", title: t("modules.kanjiTitle"), desc: t("modules.kanjiDesc") },
    { href: "/vocab", title: t("modules.vocabTitle"), desc: t("modules.vocabDesc") },
    { href: "/grammar", title: t("modules.grammarTitle"), desc: t("modules.grammarDesc") },
  ] as const;

  return (
    <Container className="py-12">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>

      {stats && (
        <section aria-label={t("a11y.progress")} className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <LevelCard xp={stats.xp} level={stats.level} />
          <StreakCard
            streakCurrent={stats.streakCurrent}
            streakLongest={stats.streakLongest}
            lastActiveDate={stats.lastActiveDate}
            today={today}
          />
          <SrsDueCard srsDueCount={stats.srsDueCount} />
        </section>
      )}

      {stats && (
        <section aria-labelledby="badges-heading" className="mt-10">
          <h2 id="badges-heading" className="mb-3 text-lg font-semibold">
            {t("badges.heading")}
          </h2>
          <BadgesGrid badges={stats.badges} />
        </section>
      )}

      <section aria-labelledby="recommendations-heading" className="mt-10">
        <h2 id="recommendations-heading" className="mb-3 text-lg font-semibold">
          {t("recommendationsHeading")}
        </h2>
        <Suspense fallback={<p className="text-sm text-muted-foreground">{t("recommendationsLoading")}</p>}>
          <RecommendationSection limit={8} />
        </Suspense>
      </section>

      <section aria-labelledby="modules-heading" className="mt-10">
        <h2 id="modules-heading" className="mb-3 text-lg font-semibold">
          {t("modules.heading")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m) => (
            <Link key={m.href} href={m.href} className="group">
              <Card className="h-full transition-colors group-hover:border-primary">
                <CardHeader>
                  <CardTitle>{m.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{m.desc}</CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </Container>
  );
}
