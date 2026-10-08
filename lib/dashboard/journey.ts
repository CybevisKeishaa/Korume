import { CURRICULUM_LEVELS } from "@/lib/curriculum/manifest";
import type { JlptLevel } from "@/lib/conversation-types";

export type JourneyNodeState = "completed" | "current" | "locked" | "unavailable";

export interface JourneyLevelRow {
  level: JlptLevel;
  coreTotal: number;
  coreCompleted: number;
  plusTotal: number;
  plusAccessible: number;
  next: { videoId: string; title: string; position: number } | null;
}

export interface JourneyNode {
  level: JlptLevel;
  state: JourneyNodeState;
  percent: number | null;
}

export type JourneyView =
  | { kind: "authoring" }
  | {
    kind: "active";
    nodes: JourneyNode[];
    current: JlptLevel;
    next: { videoId: string; title: string } | null;
    remaining: number;
    plus: { total: number; accessible: number };
  }
  | { kind: "complete"; nodes: JourneyNode[] };

const EMPTY_ROW: Omit<JourneyLevelRow, "level"> = {
  coreTotal: 0,
  coreCompleted: 0,
  plusTotal: 0,
  plusAccessible: 0,
  next: null,
};

export function buildJourney(rows: readonly JourneyLevelRow[]): JourneyView {
  const byLevel = new Map(rows.map((row) => [row.level, row]));
  const ordered = CURRICULUM_LEVELS.map((level) => byLevel.get(level) ?? { level, ...EMPTY_ROW });
  const available = ordered.filter((row) => row.coreTotal > 0);
  if (!available.length) return { kind: "authoring" };

  const current = ordered.find((row) => row.coreTotal > 0 && row.coreCompleted < row.coreTotal);
  if (!current) {
    return {
      kind: "complete",
      nodes: available.slice(-3).map((row) => ({ level: row.level, state: "completed", percent: 100 })),
    };
  }

  const currentIndex = CURRICULUM_LEVELS.indexOf(current.level);
  const windowStart = Math.max(0, Math.min(currentIndex - 1, 2));
  const nodes = ordered.slice(windowStart, windowStart + 3).map((row): JourneyNode => ({
    level: row.level,
    state: row.coreTotal === 0
      ? "unavailable"
      : row.coreCompleted === row.coreTotal
        ? "completed"
        : row.level === current.level
          ? "current"
          : "locked",
    percent: row.coreTotal > 0 ? Math.round(100 * row.coreCompleted / row.coreTotal) : null,
  }));

  return {
    kind: "active",
    nodes,
    current: current.level,
    next: current.next && { videoId: current.next.videoId, title: current.next.title },
    remaining: current.coreTotal - current.coreCompleted,
    plus: { total: current.plusTotal, accessible: current.plusAccessible },
  };
}
