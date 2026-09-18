import { describe, expect, it } from "vitest";

import {
  adminEnqueueLessonCreationSchema,
  enqueueLessonCreationSchema,
  lessonCreationJobIdSchema,
} from "./lesson-creation";

describe("enqueueLessonCreationSchema", () => {
  it("resolves a watch URL to its eleven-character video id", () => {
    const parsed = enqueueLessonCreationSchema.parse({
      youtubeUrl: " https://www.youtube.com/watch?v=dQw4w9WgXcQ ",
    });

    expect(parsed.youtubeVideoId).toBe("dQw4w9WgXcQ");
  });

  it("accepts a bare video id, matching the existing import contract", () => {
    expect(enqueueLessonCreationSchema.parse({ youtubeUrl: "dQw4w9WgXcQ" }).youtubeVideoId).toBe(
      "dQw4w9WgXcQ",
    );
  });

  it.each([
    ["empty", ""],
    ["whitespace", "   "],
    ["not a video URL", "https://example.com/watch?v=nope"],
    ["too short an id", "abc"],
  ])("rejects %s", (_label, youtubeUrl) => {
    expect(enqueueLessonCreationSchema.safeParse({ youtubeUrl }).success).toBe(false);
  });

  it("ignores client-supplied fields that belong to the server", () => {
    const parsed = enqueueLessonCreationSchema.parse({
      youtubeUrl: "dQw4w9WgXcQ",
      origin: "admin",
      state: "succeeded",
      attemptCount: 99,
      requesterId: "11111111-1111-4111-8111-111111111111",
    } as Record<string, unknown>);

    expect(parsed).toStrictEqual({ youtubeUrl: "dQw4w9WgXcQ", youtubeVideoId: "dQw4w9WgXcQ" });
  });
});

describe("adminEnqueueLessonCreationSchema", () => {
  it.each(["FREE", "PLUS"] as const)("accepts %s library access", (libraryAccess) => {
    const parsed = adminEnqueueLessonCreationSchema.parse({
      youtubeUrl: "dQw4w9WgXcQ",
      libraryAccess,
    });

    expect(parsed.libraryAccess).toBe(libraryAccess);
  });

  it("rejects PRIVATE, which is the learner origin's access and not an admin's to grant", () => {
    expect(
      adminEnqueueLessonCreationSchema.safeParse({
        youtubeUrl: "dQw4w9WgXcQ",
        libraryAccess: "PRIVATE",
      }).success,
    ).toBe(false);
  });

  it("requires library access rather than defaulting it", () => {
    expect(adminEnqueueLessonCreationSchema.safeParse({ youtubeUrl: "dQw4w9WgXcQ" }).success).toBe(
      false,
    );
  });
});

describe("lessonCreationJobIdSchema", () => {
  it("accepts a uuid", () => {
    const id = "3f1d6b7a-2c4e-4a9b-8d31-9c0f5e6a7b81";
    expect(lessonCreationJobIdSchema.parse(id)).toBe(id);
  });

  it.each([
    ["a non-uuid", "not-a-uuid"],
    ["an empty string", ""],
    ["a SQL fragment", "' or 1=1 --"],
  ])("rejects %s", (_label, value) => {
    expect(lessonCreationJobIdSchema.safeParse(value).success).toBe(false);
  });
});
