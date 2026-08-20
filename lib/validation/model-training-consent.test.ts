import { describe, expect, it } from "vitest";
import { modelTrainingConsentSchema } from "./model-training-consent";

/**
 * CLAUDE.md §2 rule 2: consent must be explicit, opt-in. The one thing this
 * schema must never do is supply a default that turns a missing `consent`
 * field into consent — that would make an absent value silently mean "yes".
 */
describe("modelTrainingConsentSchema", () => {
  it("rejects a body missing consent — an absent value must never be treated as consent", () => {
    const parsed = modelTrainingConsentSchema.safeParse({});
    expect(parsed.success).toBe(false);
  });

  it("accepts an explicit false", () => {
    const parsed = modelTrainingConsentSchema.safeParse({ consent: false });
    expect(parsed).toMatchObject({ success: true, data: { consent: false } });
  });

  it("accepts an explicit true", () => {
    const parsed = modelTrainingConsentSchema.safeParse({ consent: true });
    expect(parsed).toMatchObject({ success: true, data: { consent: true } });
  });
});
