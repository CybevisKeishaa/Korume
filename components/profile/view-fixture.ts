import type { ProfileView } from "@/lib/profile/view";

/** A full ProfileView for component tests; override per test. */
export function makeView(over: Partial<ProfileView> = {}): ProfileView {
  return {
    identity: {
      displayName: "Keishaa", username: "keishaa", bio: "Learning slowly.", country: "VN", nativeLanguage: "vi",
      targetJlptLevel: "N2", learningGoal: "I want to speak naturally during my trip.", preferredPractices: ["shadowing"],
      timeZone: "Asia/Bangkok", avatarUrl: null, hasUploadedAvatar: false, accountCreatedAt: "2026-03-05T00:00:00.000Z",
      firstKnownLearningAt: "2026-03-10T00:00:00.000Z", subtitle: { translation: "reveal", furigana: "always" },
      dailyMinutes: 20, companionEnabled: true,
    },
    stats: { streakCurrent: 12, level: 4, totalXp: 8420, videoLessonsCompleted: 14, wordsLearned: 1286, studySeconds: 94 * 3600 + 20 * 60 + 59, trackedSince: "2026-04-01T00:00:00.000Z" },
    journey: [
      { kind: "first_shadow", at: "2026-08-01T00:00:00.000Z", label: "頑張って" },
      { kind: "first_activity", at: "2026-03-10T00:00:00.000Z", label: null },
    ],
    favoriteSources: ["anime", "nhk"],
    korumeship: { since: "2026-04-01T00:00:00.000Z" },
    todaysMemory: { id: "m1", lineTextJp: "頑張って。", title: null, occurredAt: "2026-08-12T05:00:00.000Z" },
    achievements: [{ id: "b1", name: "First Shadow", iconUrl: null, earnedAt: "2026-08-01T00:00:00.000Z" }],
    ...over,
  };
}
