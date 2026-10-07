/** Plain data only: this crosses the RSC boundary (no functions, no Dates). */
export type MilestoneKind =
  | "first_activity" | "first_video_completed" | "first_mastered_word" | "first_certification_passed"
  | "badge_earned" | "first_meeting" | "first_shadow" | "jlpt_passed" | "pinned_line";

export interface ProfileView {
  identity: {
    displayName: string; username: string | null; bio: string | null; country: string | null;
    nativeLanguage: string | null; targetJlptLevel: string | null; learningGoal: string | null;
    preferredPractices: string[]; timeZone: string; avatarUrl: string | null; hasUploadedAvatar: boolean;
    accountCreatedAt: string; firstKnownLearningAt: string | null;
    subtitle: { translation: "hidden" | "reveal" | "always"; furigana: "always" | "adaptive" | "hidden" };
    dailyMinutes: number; companionEnabled: boolean;
  };
  stats: {
    streakCurrent: number; level: number; totalXp: number; videoLessonsCompleted: number; wordsLearned: number;
    studySeconds: number; trackedSince: string | null;
  };
  journey: { kind: MilestoneKind; at: string; label: string | null }[];
  favoriteSources: string[] | null; // null = not enough evidence (R11 #2)
  korumeship: { since: string | null } | null; // null when Korume is off
  todaysMemory: { id: string; lineTextJp: string | null; title: string | null; occurredAt: string } | null;
  achievements: { id: string; name: string; iconUrl: string | null; earnedAt: string }[];
}
