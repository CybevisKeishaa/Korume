import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/data/videos";
import { readPreferences } from "@/lib/data/preferences";
import { getStreak } from "@/lib/data/streak";
import { getStudyTime, getTrackedSince } from "@/lib/data/study-time";
import { MASTERY_THRESHOLD } from "@/lib/data/difficulty";
import { mapJourney } from "@/lib/data/profile-journey";
import { levelForXp } from "@/lib/gamification/level";
import { getStudyTimezone } from "@/lib/time/study-timezone";
import type { ProfileView } from "@/lib/profile/view";

const JOURNEY_LIMIT = 20;
const FAVORITES = { p_min_total: 3, p_min_per_source: 2, p_limit: 6 };

interface UserRow {
  name: string | null; email: string; username: string | null; bio: string | null; country: string | null;
  native_language: string | null; target_jlpt_level: string | null; learning_goal: string | null;
  preferred_practices: string[]; avatar_url: string | null; avatar_path: string | null; created_at: string;
  daily_minutes: number;
}
interface BadgeJoinRow { earned_at: string; badges: { id: string; name: string; icon_url: string | null } | null }
interface MemoryRow { id: string; line_text_jp: string | null; title: string | null; occurred_at: string }

export type GetProfileResult = { ok: true; data: ProfileView } | { ok: false; status: 401 };

const iso = (value: string): string => new Date(value).toISOString();
const isoOrNull = (value: string | null | undefined): string | null => (value ? iso(value) : null);

export async function getProfile(): Promise<GetProfileResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const { timeZone } = await getStudyTimezone();
  const prefs = await readPreferences(supabase, user.id);
  const companion = prefs.companionEnabled;
  const now = new Date();

  const [userRes, statsRes, badgesRes, streak, studyTime, trackedSince, firstRes, countsRes, journeyRes, favRes, meetingRes, memoryRes] =
    await Promise.all([
      supabase.from("users")
        .select("name, email, username, bio, country, native_language, target_jlpt_level, learning_goal, preferred_practices, avatar_url, avatar_path, created_at, daily_minutes")
        .eq("id", user.id).maybeSingle(),
      supabase.from("user_stats").select("xp").eq("user_id", user.id).maybeSingle(),
      supabase.from("user_badges").select("earned_at, badges(id, name, icon_url)").eq("user_id", user.id)
        .order("earned_at", { ascending: false }),
      getStreak(supabase, user.id, timeZone, prefs.scheduleDays, now),
      getStudyTime(new Date(0), now),
      getTrackedSince(),
      supabase.rpc("first_known_learning_at"),
      supabase.rpc("profile_counts", { p_mastery: MASTERY_THRESHOLD }),
      supabase.rpc("profile_journey", { p_limit: JOURNEY_LIMIT, p_include_companion: companion }),
      supabase.rpc("favorite_lesson_sources", FAVORITES),
      // Korume off: nothing is read from the companion at all.
      companion
        ? supabase.from("companion_memories").select("occurred_at").eq("user_id", user.id).eq("memory_type", "first_meeting")
            .order("occurred_at", { ascending: true }).limit(1).maybeSingle()
        : Promise.resolve(null),
      companion ? supabase.rpc("todays_memory", { p_tz: timeZone }) : Promise.resolve(null),
    ]);

  for (const res of [userRes, statsRes, badgesRes, firstRes, countsRes, journeyRes, favRes, meetingRes, memoryRes]) {
    if (res?.error) throw res.error;
  }
  const row = userRes.data as UserRow | null;
  if (!row) return { ok: false, status: 401 };

  const xp = (statsRes.data as { xp: number } | null)?.xp ?? 0;
  const counts = (countsRes.data as { video_lessons_completed: number; words_learned: number }[] | null)?.[0];
  const favorites = (favRes.data as { slug: string }[] | null) ?? [];
  const memory = (memoryRes?.data as MemoryRow[] | null)?.[0] ?? null;

  return {
    ok: true,
    data: {
      identity: {
        displayName: row.name ?? row.email.split("@")[0] ?? "",
        username: row.username, bio: row.bio, country: row.country, nativeLanguage: row.native_language,
        targetJlptLevel: row.target_jlpt_level, learningGoal: row.learning_goal,
        preferredPractices: row.preferred_practices ?? [], timeZone,
        // Task 12 swaps in the signed avatar URL; until then the OAuth picture stands in.
        avatarUrl: row.avatar_url, hasUploadedAvatar: row.avatar_path !== null,
        accountCreatedAt: iso(row.created_at), firstKnownLearningAt: isoOrNull(firstRes.data as string | null),
        subtitle: { translation: prefs.readingTranslation, furigana: prefs.readingFurigana },
        dailyMinutes: row.daily_minutes, companionEnabled: companion,
      },
      stats: {
        streakCurrent: streak.current, level: levelForXp(xp).level, totalXp: xp,
        videoLessonsCompleted: counts?.video_lessons_completed ?? 0, wordsLearned: counts?.words_learned ?? 0,
        studySeconds: studyTime.totalSeconds, trackedSince,
      },
      journey: mapJourney(journeyRes.data as { kind: string; at: string; label: string | null }[] | null),
      favoriteSources: favorites.length > 0 ? favorites.map((f) => f.slug) : null,
      korumeship: companion
        ? { since: isoOrNull((meetingRes?.data as { occurred_at: string } | null)?.occurred_at) }
        : null,
      todaysMemory: memory
        ? { id: memory.id, lineTextJp: memory.line_text_jp, title: memory.title, occurredAt: iso(memory.occurred_at) }
        : null,
      achievements: ((badgesRes.data as BadgeJoinRow[] | null) ?? []).flatMap((b) =>
        b.badges ? [{ id: b.badges.id, name: b.badges.name, iconUrl: b.badges.icon_url, earnedAt: iso(b.earned_at) }] : [],
      ),
    },
  };
}
