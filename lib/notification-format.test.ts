import { describe, expect, it } from "vitest";
import { describeNotification, formatRelativeTime } from "./notification-format";
import type { NotificationRow } from "./notification-types";

function row(overrides: Partial<NotificationRow>): NotificationRow {
  return {
    id: "n1",
    type: "badge_earned",
    payload: {},
    readAt: null,
    createdAt: "2026-07-13T00:00:00.000Z",
    ...overrides,
  };
}

describe("describeNotification", () => {
  it("describes a badge_earned notification", () => {
    expect(
      describeNotification(row({ type: "badge_earned", payload: { badgeId: "b1", badgeName: "First Steps" } })),
    ).toBe("You earned First Steps");
  });

  it("describes a level_up notification", () => {
    expect(describeNotification(row({ type: "level_up", payload: { level: 5 } }))).toBe(
      "You reached Level 5",
    );
  });

  it("describes an srs_due notification", () => {
    expect(describeNotification(row({ type: "srs_due", payload: { dueCount: 12 } }))).toBe(
      "12 cards are due",
    );
  });

  it("falls back to a generic message for a malformed payload rather than crashing", () => {
    expect(describeNotification(row({ type: "badge_earned", payload: null }))).toBe(
      "You have a new notification",
    );
    expect(describeNotification(row({ type: "level_up", payload: { level: "five" } }))).toBe(
      "You have a new notification",
    );
    expect(describeNotification(row({ type: "srs_due", payload: {} }))).toBe(
      "You have a new notification",
    );
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-07-13T12:00:00.000Z");

  it("renders 'just now' for anything under a minute old", () => {
    expect(formatRelativeTime("2026-07-13T11:59:40.000Z", now)).toBe("just now");
  });

  it("renders minutes ago", () => {
    expect(formatRelativeTime("2026-07-13T11:45:00.000Z", now)).toBe("15m ago");
  });

  it("renders hours ago", () => {
    expect(formatRelativeTime("2026-07-13T09:00:00.000Z", now)).toBe("3h ago");
  });

  it("renders days ago", () => {
    expect(formatRelativeTime("2026-07-10T12:00:00.000Z", now)).toBe("3d ago");
  });

  it("falls back to an absolute short date beyond a week", () => {
    expect(formatRelativeTime("2026-06-01T12:00:00.000Z", now)).toBe(
      new Date("2026-06-01T12:00:00.000Z").toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
    );
  });
});
