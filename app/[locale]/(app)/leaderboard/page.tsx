import { redirect } from "@/lib/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLeaderboard } from "@/lib/data/leaderboard";
import { Container } from "@/components/ui/container";
import { LeaderboardBoard } from "@/components/community/leaderboard-board";
import { getLocale, getTranslations } from "@/lib/i18n/server";

export const metadata = { title: "Leaderboard" };
export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const t = await getTranslations("leaderboard");
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // (app) layout already redirects unauthenticated users; this is defence in depth.
  if (!user) redirect({ href: "/login", locale: await getLocale() });

  const [result, { data: userRow }] = await Promise.all([
    getLeaderboard(),
    supabase.from("users").select("leaderboard_opt_in").eq("id", user.id).single(),
  ]);

  const page = result.ok ? result.data : { leaderboard: [], callerWeeklyXp: 0, callerRank: null };
  const initialOptIn = Boolean((userRow as { leaderboard_opt_in: boolean } | null)?.leaderboard_opt_in);

  return (
    <Container className="py-8">
      <h1 className="text-2xl font-bold">{t("page.heading")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("page.subtitle")}</p>

      <div className="mt-6">
        <LeaderboardBoard initialPage={page} initialOptIn={initialOptIn} />
      </div>
    </Container>
  );
}
