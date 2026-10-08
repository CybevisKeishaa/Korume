import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTEXT_ID_MAX, MAX_EXTENSION_SECONDS, SESSION_GAP_SECONDS } from "./constants";
import { STUDY_SURFACES, isValidContext } from "./surfaces";

const UUID = "123e4567-e89b-12d3-a456-426614174000";

describe("study surfaces", () => {
  it("lists the measured surfaces", () => {
    expect([...STUDY_SURFACES]).toEqual([
      "shadowing", "dictation", "summary", "srs_review", "kanji", "certification", "conversation", "korume_chat",
    ]);
  });

  it("validates context ids per surface", () => {
    expect(isValidContext("shadowing", UUID)).toBe(true);
    expect(isValidContext("shadowing", "abc")).toBe(false);
    expect(isValidContext("shadowing", null)).toBe(false);
    expect(isValidContext("srs_review", "vocab")).toBe(true);
    expect(isValidContext("srs_review", "grammar")).toBe(false);
    expect(isValidContext("korume_chat", null)).toBe(true);
    expect(isValidContext("conversation", null)).toBe(true);
    expect(isValidContext("kanji", "x".repeat(CONTEXT_ID_MAX + 1))).toBe(false);
  });
});

describe("SQL and TS agree on the study-time facts", () => {
  const sql = readFileSync("supabase/migrations/20261007000044_port_profile.sql", "utf8");
  const section = sql.slice(sql.indexOf("create table study_sessions"));

  it("gap and extension literals", () => {
    expect(section).toContain(`v_gap interval := interval '${SESSION_GAP_SECONDS} seconds'`);
    expect(section).toContain(`v_ext interval := interval '${MAX_EXTENSION_SECONDS} seconds'`);
  });

  it("surface check list and context length", () => {
    const m = /surface text not null check \(surface in \(([^)]*)\)\)/.exec(section);
    expect(m).not.toBeNull();
    const listed = [...(m?.[1] ?? "").matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
    expect(listed).toEqual([...STUDY_SURFACES]);
    expect(section).toContain(`length(context_id) between 1 and ${CONTEXT_ID_MAX}`);
  });
});
