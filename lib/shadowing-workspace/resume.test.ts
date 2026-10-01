import { describe, expect, it } from "vitest";
import { resolveStartPosition } from "./resume";
import type { ResumeInput } from "./resume";
import type { WorkspaceLine } from "./types";

const lines: WorkspaceLine[] = [
  { id: "A", index: 0, startTime: 0, endTime: 100, textJp: "A", textTranslation: null, furigana: null },
  { id: "B", index: 1, startTime: 100, endTime: 700, textJp: "B", textTranslation: null, furigana: null },
  { id: "C", index: 2, startTime: 700, endTime: null, textJp: "C", textTranslation: null, furigana: null },
];
const input = (overrides: Partial<ResumeInput> = {}): ResumeInput => ({
  lines, duration: 1396, deepLinkLineId: null, resumeBehavior: "resume", server: null, session: null, ...overrides,
});
const session = (position: number, syncedServerAt: string | null = "2026-10-01T10:00:00Z") => ({ userId: "u", videoId: "v", position, savedAt: 1, syncedServerAt });

describe("resolveStartPosition", () => {
  it("honours a valid deep link before restart", () => {
    expect(resolveStartPosition(input({ deepLinkLineId: "B", resumeBehavior: "restart" }))).toEqual({ position: 100, source: "deep-link" });
  });

  it("ignores a foreign deep link and falls through", () => {
    expect(resolveStartPosition(input({ deepLinkLineId: "foreign", session: session(600) }))).toEqual({ position: 100, source: "session" });
  });

  it("restarts when requested without a deep link", () => {
    expect(resolveStartPosition(input({ resumeBehavior: "restart", session: session(600) }))).toEqual({ position: 0, source: "start" });
  });

  it("snaps a valid server position to its sentence", () => {
    expect(resolveStartPosition(input({ server: { position: 600, lastWatchedAt: null } }))).toEqual({ position: 100, source: "server" });
  });

  it("rejects too-early, near-end, overflow, and non-finite winning positions", () => {
    for (const position of [4.9, 1390, 5000, NaN]) {
      expect(resolveStartPosition(input({ server: { position, lastWatchedAt: null } }))).toEqual({ position: 0, source: "start" });
    }
  });

  it("arbitrates session and server by only valid comparable server clocks", () => {
    expect(resolveStartPosition(input({ session: session(600), server: { position: 800, lastWatchedAt: "2026-10-01T10:00:00Z" } }))).toEqual({ position: 100, source: "session" });
    expect(resolveStartPosition(input({ session: session(600), server: { position: 800, lastWatchedAt: "2026-10-01T10:05:00Z" } }))).toEqual({ position: 700, source: "server" });
    expect(resolveStartPosition(input({ session: session(600, null), server: null }))).toEqual({ position: 100, source: "session" });
    expect(resolveStartPosition(input({ session: null, server: { position: 600, lastWatchedAt: null } }))).toEqual({ position: 100, source: "server" });
    expect(resolveStartPosition(input({ session: session(600, null), server: { position: 800, lastWatchedAt: "2026-10-01T10:05:00Z" } }))).toEqual({ position: 700, source: "server" });
    expect(resolveStartPosition(input({ session: session(600), server: { position: 800, lastWatchedAt: "not-a-date" } }))).toEqual({ position: 100, source: "session" });
    expect(resolveStartPosition(input({ session: session(600, "not-a-date"), server: { position: 800, lastWatchedAt: "2026-10-01T10:05:00Z" } }))).toEqual({ position: 700, source: "server" });
  });

  it("does not fall back when the clock-selected winner is invalid", () => {
    expect(resolveStartPosition(input({ session: session(600), server: { position: 1390, lastWatchedAt: "2026-10-01T10:05:00Z" } }))).toEqual({ position: 0, source: "start" });
  });

  it("does not apply duration overflow or near-end checks without duration", () => {
    expect(resolveStartPosition(input({ duration: null, server: { position: 5000, lastWatchedAt: null } }))).toEqual({ position: 700, source: "server" });
  });
});
