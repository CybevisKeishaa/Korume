import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n";
import { getTranslations } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { getKanjiReviewQueue } from "@/lib/data/kanji-review";
import { readPreferences } from "@/lib/data/preferences";
import { getStreak } from "@/lib/data/streak";
import { getStudyTimezone } from "@/lib/time/study-timezone";
import { jlptLevelSchema } from "@/lib/validation/content";
import { KanjiReviewSession } from "@/components/kanji/kanji-review-session";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: { locale: Locale } }): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "kanji" });
  return { title: t("reviewTitle") };
}

/** The footer's day streak, as the dashboard derives it. A failure hides the line; it never stops the review. */
async function dayStreak(): Promise<number | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ timeZone }, prefs] = await Promise.all([getStudyTimezone(), readPreferences(supabase, user.id)]);
  return (await getStreak(supabase, user.id, timeZone, prefs.scheduleDays)).current;
}

/** `/kanji/review` in the `(focus)` chrome (spec §6): `?level=` picks the JLPT deck, `?focus=` puts one kanji first. */
export default async function KanjiReviewPage({ searchParams }: { searchParams: { level?: string; focus?: string } }) {
  const level = jlptLevelSchema.safeParse(searchParams.level).data;
  const [t, cards, streak] = await Promise.all([
    getTranslations("kanji"),
    getKanjiReviewQueue({ level, focus: searchParams.focus }),
    dayStreak().catch((error: unknown) => {
      console.error(error);
      return null;
    }),
  ]);

  return (
    <KanjiReviewSession
      // A new deck (another ?level= / ?focus=, e.g. the inspect's "Study" link over this page) is a new session;
      // `?kanji=` is not in the key, so opening the inspect keeps the running one.
      key={`${level ?? ""}|${searchParams.focus ?? ""}`}
      cards={cards}
      deckLabel={level ? t("quickInspect.jlpt", { level }) : t("review.today")}
      streak={streak}
      backHref={`/kanji${level ? `?level=${level}` : ""}`}
    />
  );
}
