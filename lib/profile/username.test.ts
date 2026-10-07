import { describe, expect, it } from "vitest";
import { normalizeUsername, RESERVED_USERNAMES, validateUsername } from "./username";

describe("username", () => {
  it("normalizes by trimming and lower-casing", () => {
    expect(normalizeUsername("  KeiShaa ")).toBe("keishaa");
  });

  it.each(["abc", "a_b_9", "a".repeat(20)])("accepts %s", (raw) => {
    expect(validateUsername(raw)).toEqual({ ok: true, value: raw });
  });

  it.each(["ab", "a".repeat(21), "kei shaa", "kéi", "kei-shaa"])("rejects %s as format", (raw) => {
    expect(validateUsername(raw)).toEqual({ ok: false, reason: "format" });
  });

  it("rejects every reserved name in any case", () => {
    expect(validateUsername("Admin")).toEqual({ ok: false, reason: "reserved" });
    for (const name of RESERVED_USERNAMES) {
      // "me" is too short for the pattern, so format rejects it first; every other name reaches the reserved check.
      const reason = name.length < 3 ? "format" : "reserved";
      expect(validateUsername(name.toUpperCase())).toEqual({ ok: false, reason });
    }
  });

  it("reserves exactly the spec list", () => {
    expect([...RESERVED_USERNAMES].sort()).toEqual(
      "admin api app auth dashboard edit help korume login logout me new null profile register root settings support system undefined user users".split(" "),
    );
  });
});
