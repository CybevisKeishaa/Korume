"use client";

import { MascotPose } from "@/components/mascot/mascot-pose";
import { useTranslations } from "@/lib/i18n";
import type { MoodResult } from "@/lib/practice/korume-mood";

/**
 * Korume's reaction to a practice result (lib/practice/korume-mood.ts): the pose is decorative (MascotPose sets
 * `alt=""` and `aria-hidden`); the quip is text: Pronunciation puts it in its take status, Listening keeps it outside
 * the P14 live region (facts are announced, flavour is not). Nothing for `null`.
 * Size and the short-panel hide live in globals.css (`.practice-korume`).
 */
export function PracticeKorume({ reaction }: { reaction: MoodResult | null }) {
  return reaction === null ? null : <MascotPose pose={`korume-${reaction.mood}`} size="sm" className="practice-korume" />;
}

/** Two quips per mood, taken in turn, so the same moment does not repeat word for word. */
export function KorumeQuip({ reaction }: { reaction: MoodResult | null }) {
  const t = useTranslations("shadowing.workspace.practice.korume");
  if (reaction === null) return null;
  return <p data-korume-quip className="text-body font-semibold text-primary-strong">
    {t(`${reaction.mood}.${reaction.turn % 2 === 0 ? "a" : "b"}`, { streak: reaction.streak })}
  </p>;
}
