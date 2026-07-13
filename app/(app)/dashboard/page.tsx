import { Suspense } from "react";
import Link from "next/link";
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

const MODULES = [
  { href: "/kanji", title: "Kanji", desc: "Stroke order, readings, SRS." },
  { href: "/vocab", title: "Vocabulary", desc: "Words by level + flashcard review." },
  { href: "/grammar", title: "Grammar", desc: "Patterns with examples." },
] as const;

export default async function DashboardPage() {
  const statsResult = await getUserStats();
  const stats = statsResult.ok ? statsResult.data : null;
  const today = vnDateString(new Date());

  return (
    <Container className="py-12">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="mt-1 text-muted-foreground">Pick a module to start studying.</p>

      {stats && (
        <section aria-label="Your progress" className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
            Badges
          </h2>
          <BadgesGrid badges={stats.badges} />
        </section>
      )}

      <section aria-labelledby="recommendations-heading" className="mt-10">
        <h2 id="recommendations-heading" className="mb-3 text-lg font-semibold">
          Recommended for you
        </h2>
        <Suspense fallback={<p className="text-sm text-muted-foreground">Finding videos at your level…</p>}>
          <RecommendationSection limit={8} />
        </Suspense>
      </section>

      <section aria-labelledby="modules-heading" className="mt-10">
        <h2 id="modules-heading" className="mb-3 text-lg font-semibold">
          Modules
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
