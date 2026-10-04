import { createHash } from "node:crypto";
import type { LessonSnapshot, ReviewReason } from "../snapshot";
import { modeQuality, type Quality } from "../thresholds";

/**
 * Everything the reflection may know about the learner (spec §5.2): qualities, never numbers; this lesson only.
 * Nothing from navigation, history or Companion memory has a field here, so it cannot reach the prompt.
 */
export interface ReflectionEvidence {
  modes: { shadowing: Quality; pronunciation: Quality; listening: Quality; retention: Quality };
  savedAnything: boolean;
  /** At most three, each with its first reason. */
  targets: { lineId: string; lineText: string; reason: ReviewReason }[];
  bestLine: { lineId: string; lineText: string } | null;
}

export function projectEvidence(snapshot: LessonSnapshot): ReflectionEvidence {
  const { status, savedKnowledge } = snapshot;
  return {
    modes: {
      shadowing: modeQuality("shadowing", status.shadowing),
      pronunciation: modeQuality("pronunciation", status.pronunciation),
      listening: modeQuality("listening", status.listening),
      retention: modeQuality("retention", status.retention),
    },
    savedAnything: savedKnowledge.vocabulary + savedKnowledge.expressions + savedKnowledge.grammar > 0,
    targets: snapshot.reviewTargets.slice(0, 3).map((target) => ({
      lineId: target.lineId, lineText: target.lineText, reason: target.reasons[0] as ReviewReason,
    })),
    bestLine: snapshot.bestLine,
  };
}

export function isEmptyEvidence(evidence: ReflectionEvidence): boolean {
  return Object.values(evidence.modes).every((quality) => quality === "not_started")
    && !evidence.savedAnything && evidence.targets.length === 0 && evidence.bestLine === null;
}

/** Part of the reflection's identity (spec §5.4): it moves when a quality band moves, not with every score. */
export function evidenceFingerprint(evidence: ReflectionEvidence): string {
  return createHash("sha256").update(JSON.stringify(evidence), "utf8").digest("hex");
}
