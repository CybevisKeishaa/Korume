import { describe, expect, it } from "vitest";
import { scoreSessionSchema } from "./pronunciation";
const sessionId = "550e8400-e29b-41d4-a716-446655440000";
describe("scoreSessionSchema", () => {
  it("accepts only a session UUID", () => { expect(scoreSessionSchema.parse({ sessionId })).toEqual({ sessionId }); });
  it.each([{}, { sessionId: "x" }, { sessionId, referenceText: "client text" }, { sessionId, audio: "client audio" }, { sessionId, shadowingSessionId: sessionId }])("rejects malformed and extra fields %j", (body) => {
    expect(scoreSessionSchema.safeParse(body).success).toBe(false);
  });
});
