import type { LessonSnapshot } from "../snapshot";

/** Spec §5.5: the deterministic card when no AI reflection can be shown. Copy lives in the client catalog. */
export type ReflectionFallback =
  | { kind: "best_line"; line: string }
  | { kind: "target"; line: string }
  | { kind: "state"; state: "not_started" | "in_progress" | "complete" };

export function buildReflectionFallback(snapshot: LessonSnapshot): ReflectionFallback {
  if (snapshot.bestLine) return { kind: "best_line", line: snapshot.bestLine.lineText };
  const target = snapshot.reviewTargets[0];
  if (target) return { kind: "target", line: target.lineText };
  const shadowing = snapshot.status.shadowing.kind;
  return { kind: "state", state: shadowing === "complete" ? "complete" : shadowing === "in_progress" ? "in_progress" : "not_started" };
}
