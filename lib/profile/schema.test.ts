import { describe, expect, it } from "vitest";
import { BIO_MAX, LEARNING_GOAL_MAX, profileFieldsSchema } from "./schema";

const VALID = {
  displayName: "  Kei  ",
  username: "  KeiShaa ",
  bio: "  hello  ",
  country: "VN",
  timeZone: "Asia/Tokyo",
  nativeLanguage: "vi",
  targetJlptLevel: "N3",
  learningGoal: "Pass N3",
  preferredPractices: ["shadowing", "kanji"],
};
const parse = (patch: Record<string, unknown>) => profileFieldsSchema.safeParse({ ...VALID, ...patch });
// U+1F600 is one code point but two UTF-16 units: length-based caps would disagree with code-point caps.
const emoji = (n: number) => "\u{1F600}".repeat(n);

describe("profileFieldsSchema", () => {
  it("accepts a full valid object and emits trimmed, normalized values", () => {
    const result = profileFieldsSchema.parse(VALID);
    expect(result).toMatchObject({ displayName: "Kei", username: "keishaa", bio: "hello", timeZone: "Asia/Tokyo" });
  });

  it("rejects unknown keys", () => {
    expect(parse({ avatarPath: "x" }).success).toBe(false);
  });

  it("caps bio and learning goal in code points and rejects rather than truncates", () => {
    expect(parse({ bio: emoji(BIO_MAX) }).success).toBe(true);
    expect(parse({ bio: emoji(BIO_MAX + 1) }).success).toBe(false);
    expect(parse({ learningGoal: emoji(LEARNING_GOAL_MAX) }).success).toBe(true);
    expect(parse({ learningGoal: emoji(LEARNING_GOAL_MAX + 1) }).success).toBe(false);
  });

  it("rejects duplicate and unknown practices", () => {
    expect(parse({ preferredPractices: ["kanji", "kanji"] }).success).toBe(false);
    expect(parse({ preferredPractices: ["karaoke"] }).success).toBe(false);
  });

  it("allows null native language, JLPT target, country and username", () => {
    const result = parse({ nativeLanguage: null, targetJlptLevel: null, country: null, username: null });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown JLPT level, country or language", () => {
    expect(parse({ targetJlptLevel: "N6" }).success).toBe(false);
    expect(parse({ country: "XX" }).success).toBe(false);
    expect(parse({ nativeLanguage: "xx" }).success).toBe(false);
  });

  it("runs the username validator", () => {
    expect(parse({ username: "  " }).data?.username).toBeNull();
    expect(parse({ username: "Admin" }).error?.issues[0]?.message).toBe("reserved");
    expect(parse({ username: "a-b" }).error?.issues[0]?.message).toBe("format");
  });

  it("requires a 1-50 character display name after trimming", () => {
    expect(parse({ displayName: "   " }).success).toBe(false);
    expect(parse({ displayName: "a".repeat(51) }).success).toBe(false);
    expect(parse({ displayName: "a".repeat(50) }).success).toBe(true);
  });

  it("canonicalizes the time zone and rejects an unknown one", () => {
    const expected = new Intl.DateTimeFormat("en", { timeZone: "asia/tokyo" }).resolvedOptions().timeZone;
    expect(parse({ timeZone: "asia/tokyo" }).data?.timeZone).toBe(expected);
    expect(parse({ timeZone: "Mars/Olympus" }).error?.issues[0]?.message).toBe("time_zone");
  });
});
