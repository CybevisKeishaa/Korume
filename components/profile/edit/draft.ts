import type { ProfileView } from "@/lib/profile/view";
import { PREFERRED_PRACTICES } from "@/lib/profile/practices";
import type { Locale } from "@/lib/i18n/routing";

/** The one object the form edits. `""` stands for "not set" in every optional select. */
export interface Draft {
  displayName: string;
  username: string;
  bio: string;
  country: string;
  timeZone: string;
  nativeLanguage: string;
  targetJlptLevel: string;
  learningGoal: string;
  preferredPractices: string[];
  locale: Locale;
  dailyMinutes: number;
  readingTranslation: ProfileView["identity"]["subtitle"]["translation"];
  readingFurigana: ProfileView["identity"]["subtitle"]["furigana"];
  companionEnabled: boolean;
}

export function draftReducer(state: Draft, patch: Partial<Draft>): Draft {
  return { ...state, ...patch };
}

/** Closed taxonomy, always in catalog order, so the same selection is always the same array. */
export const orderedPractices = (selected: readonly string[]): string[] =>
  PREFERRED_PRACTICES.filter((code) => selected.includes(code));

export function initialDraft(identity: ProfileView["identity"], locale: Locale): Draft {
  return {
    displayName: identity.displayName,
    username: identity.username ?? "",
    bio: identity.bio ?? "",
    country: identity.country ?? "",
    timeZone: identity.timeZone,
    nativeLanguage: identity.nativeLanguage ?? "",
    targetJlptLevel: identity.targetJlptLevel ?? "",
    learningGoal: identity.learningGoal ?? "",
    preferredPractices: orderedPractices(identity.preferredPractices),
    locale,
    dailyMinutes: identity.dailyMinutes,
    readingTranslation: identity.subtitle.translation,
    readingFurigana: identity.subtitle.furigana,
    companionEnabled: identity.companionEnabled,
  };
}

/**
 * The JSON `profile` part of `PATCH /api/profile`. `locale` is deliberately absent: the route's schema is strict
 * (a locale key is a 400) and a locale is a navigation, decided client-side.
 */
export function toPayload(draft: Draft, avatar: "keep" | "replace" | "remove") {
  return {
    fields: {
      displayName: draft.displayName,
      username: draft.username.trim() === "" ? null : draft.username,
      bio: draft.bio,
      country: draft.country || null,
      timeZone: draft.timeZone,
      nativeLanguage: draft.nativeLanguage || null,
      targetJlptLevel: draft.targetJlptLevel || null,
      learningGoal: draft.learningGoal,
      preferredPractices: draft.preferredPractices,
    },
    preferences: pickPreferences(draft),
    avatar,
  };
}

export const pickPreferences = (draft: Draft) => ({
  dailyMinutes: draft.dailyMinutes,
  readingTranslation: draft.readingTranslation,
  readingFurigana: draft.readingFurigana,
  companionEnabled: draft.companionEnabled,
});
