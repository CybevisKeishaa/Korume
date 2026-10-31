import { MascotPose } from "@/components/mascot/mascot-pose";
import type { FeedbackMood } from "@/lib/dictation/listening-feedback";

/**
 * P15: a small static Korume beside the P14 text, decorative only (MascotPose sets `alt=""` and `aria-hidden`).
 * Nothing for `null`. Its size and the short-panel hide live in globals.css (`.listening-korume`).
 */
export function ListeningFeedbackKorume({ mood }: { mood: FeedbackMood | null }) {
  return mood === null ? null : <MascotPose pose={`listening-${mood}`} size="sm" className="listening-korume" />;
}
