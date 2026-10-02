import { describe, expect, it } from "vitest";
import { parseSessionResumeRecord, sessionResumeKey } from "./session-resume-record";

describe("session resume record", () => {
  const record = { userId: "user", videoId: "video", position: 12, savedAt: 1, syncedServerAt: null };

  it("builds an account and video scoped key", () => {
    expect(sessionResumeKey("user", "video")).toBe("shadowing-resume:user:video");
  });

  it("accepts only valid records for the active account and video", () => {
    expect(parseSessionResumeRecord(JSON.stringify(record), "user", "video")).toEqual(record);
    expect(parseSessionResumeRecord(JSON.stringify(record), "other", "video")).toBeNull();
    expect(parseSessionResumeRecord(JSON.stringify(record), "user", "other")).toBeNull();
    expect(parseSessionResumeRecord("{", "user", "video")).toBeNull();
    expect(parseSessionResumeRecord(JSON.stringify({ ...record, savedAt: undefined }), "user", "video")).toBeNull();
    expect(parseSessionResumeRecord('{"userId":"user","videoId":"video","position":1e999,"savedAt":1,"syncedServerAt":null}', "user", "video")).toBeNull();
  });
});
