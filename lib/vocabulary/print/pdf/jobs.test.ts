import { describe, expect, it, vi } from "vitest";
import type { RenderPayload } from "./request";
import { createRenderJob, takeRenderJob } from "./jobs";

vi.mock("server-only", () => ({}));

const payload = { locale: "vi", title: "T", settings: {}, pages: [], resources: {} } as unknown as RenderPayload;

describe("render jobs (spec W §6.3 step 3)", () => {
  it("issues an unguessable token that works exactly once", () => {
    const token = createRenderJob({ userId: "u", lessonId: "l", payload }, 1_000);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(takeRenderJob(token, 1_001)?.payload).toBe(payload);
    expect(takeRenderJob(token, 1_002)).toBeNull();
  });
  it("expires after 60 seconds and an unknown token is null", () => {
    const token = createRenderJob({ userId: "u", lessonId: "l", payload }, 0);
    expect(takeRenderJob(token, 60_000)).toBeNull();
    expect(takeRenderJob("nope")).toBeNull();
  });
  it("lives on globalThis, so a second module instance sees the same store", async () => {
    const token = createRenderJob({ userId: "u", lessonId: "l", payload }, Date.now());
    vi.resetModules();
    const fresh = await import("./jobs");
    expect(fresh.takeRenderJob(token)?.userId).toBe("u");
  });
});
