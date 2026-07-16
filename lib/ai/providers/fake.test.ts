import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { createFakeProvider } from "./fake";

const req = {
  tier: "fast" as const,
  system: [{ text: "sys", cacheable: true }],
  messages: [{ role: "user" as const, content: "hi" }],
  maxTokens: 100,
  reasoning: false,
};

describe("fake provider", () => {
  it("returns queued text and records the request", async () => {
    const fake = createFakeProvider();
    fake.queueText("hello");
    const result = await fake.provider.generateText(req);
    expect(result.text).toBe("hello");
    expect(result.model).toBe("fake-fast");
    expect(fake.requests[0]).toEqual(req);
  });

  it("returns queued structured output", async () => {
    const fake = createFakeProvider();
    fake.queueStructured({ n: 1 });
    const result = await fake.provider.generateStructured(req, z.object({ n: z.number() }));
    expect(result.parsed).toEqual({ n: 1 });
  });

  it("validates structured output against the schema so tests cannot fake an invalid shape", async () => {
    const fake = createFakeProvider();
    fake.queueStructured({ wrong: true });
    await expect(
      fake.provider.generateStructured(req, z.object({ n: z.number() })),
    ).rejects.toThrow();
  });

  it("throws queued errors", async () => {
    const fake = createFakeProvider();
    fake.queueError(new Error("boom"));
    await expect(fake.provider.generateText(req)).rejects.toThrow("boom");
  });

  it("fails loudly when nothing is queued", async () => {
    const fake = createFakeProvider();
    await expect(fake.provider.generateText(req)).rejects.toThrow(/queued/i);
  });
});
