import { getTranslations } from "@/lib/i18n/server";
import { Link } from "@/lib/i18n/navigation";
import { Container } from "@/components/ui/container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getUserStats } from "@/lib/data/user-stats";

export const metadata = { title: "Profile" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const t = await getTranslations("profile");
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const statsResult = await getUserStats();
  const stats = statsResult.ok ? statsResult.data : null;
  const earnedBadgeCount = stats?.badges.filter((b) => b.earnedAt).length ?? 0;

  return (
    <Container className="py-12">
      <h1 className="text-2xl font-bold">{t("page.heading")}</h1>
      <Card className="mt-6 max-w-md">
        <CardHeader>
          <CardTitle>{t("page.accountHeading")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">{t("page.emailLabel")}</span> {user?.email ?? t("page.emailFallback")}
          </p>
        </CardContent>
      </Card>

      {stats && (
        <Card className="mt-6 max-w-md">
          <CardHeader>
            <CardTitle>{t("page.statsHeading")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-muted-foreground">{t("page.levelLabel")}</dt>
                <dd className="text-lg font-semibold">{stats.level.level}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("page.xpLabel")}</dt>
                <dd className="text-lg font-semibold">{stats.xp.toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("page.currentStreakLabel")}</dt>
                <dd className="text-lg font-semibold">{t("page.streakDays", { count: stats.streakCurrent })}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("page.longestStreakLabel")}</dt>
                <dd className="text-lg font-semibold">{t("page.streakDays", { count: stats.streakLongest })}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted-foreground">{t("page.badgesEarnedLabel")}</dt>
                <dd className="text-lg font-semibold">
                  {t("page.badgesCount", { earned: earnedBadgeCount, total: stats.badges.length })}
                </dd>
              </div>
            </dl>
            <Link
              href="/dashboard"
              className="mt-4 inline-block text-sm font-medium text-primary-strong underline underline-offset-2 hover:no-underline"
            >
              {t("page.viewDashboard")}
            </Link>
          </CardContent>
        </Card>
      )}
    </Container>
  );
}
