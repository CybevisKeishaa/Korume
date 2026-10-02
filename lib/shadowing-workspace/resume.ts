import type { ResumeBehavior } from "@/lib/preferences/options";
import { locateSentence } from "./sentence-lookup";
import type { SessionResumeRecord } from "./session-resume-record";
import type { WorkspaceLine } from "./types";

export interface ResumeInput {
  lines: readonly WorkspaceLine[];
  duration: number | null;
  deepLinkLineId: string | null;
  resumeBehavior: ResumeBehavior;
  server: { position: number; lastWatchedAt: string | null } | null;
  session: SessionResumeRecord | null;
}

export interface ResumeDecision { position: number; source: "deep-link" | "session" | "server" | "start" }

const timestamp = (value: string | null): number | null => {
  if (value === null) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};

export function resolveStartPosition(input: ResumeInput): ResumeDecision {
  const linked = input.deepLinkLineId === null ? undefined : input.lines.find((line) => line.id === input.deepLinkLineId);
  if (linked) return { position: linked.startTime, source: "deep-link" };
  if (input.resumeBehavior === "restart") return { position: 0, source: "start" };

  let candidate: { position: number; source: "session" | "server" } | null = null;
  if (input.session) {
    const serverAt = timestamp(input.server?.lastWatchedAt ?? null);
    const sessionAt = timestamp(input.session.syncedServerAt);
    candidate = serverAt !== null && (sessionAt === null || serverAt > sessionAt) && input.server
      ? { position: input.server.position, source: "server" }
      : { position: input.session.position, source: "session" };
  } else if (input.server) candidate = { position: input.server.position, source: "server" };
  if (!candidate || !Number.isFinite(candidate.position) || candidate.position < 5) return { position: 0, source: "start" };
  if (input.duration !== null && (candidate.position > input.duration || candidate.position >= input.duration - 10)) return { position: 0, source: "start" };

  const sentence = locateSentence(input.lines, candidate.position, input.duration).index;
  return sentence === null ? { position: 0, source: "start" } : { position: input.lines[sentence]!.startTime, source: candidate.source };
}
