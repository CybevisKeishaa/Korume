import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "./route";
import { setModelTrainingConsent } from "@/lib/data/model-training-consent";

vi.mock("@/lib/data/model-training-consent", () => ({
  setModelTrainingConsent: vi.fn(),
}));

const patch = (body: unknown) =>
  new Request("http://localhost/api/user/model-training-consent", { method: "PATCH", body: JSON.stringify(body) });

const patchRaw = (body: string) =>
  new Request("http://localhost/api/user/model-training-consent", { method: "PATCH", body });

beforeEach(() => vi.clearAllMocks());

describe("PATCH /api/user/model-training-consent", () => {
  it("rejects a body that is not valid JSON at all, without calling the data layer", async () => {
    const res = await PATCH(patchRaw("not json{"));
    expect(res.status).toBe(400);
    expect(setModelTrainingConsent).not.toHaveBeenCalled();
  });

  it("rejects a body missing consent, without calling the data layer", async () => {
    const res = await PATCH(patch({}));
    expect(res.status).toBe(400);
    expect(setModelTrainingConsent).not.toHaveBeenCalled();
  });

  it("rejects a non-boolean consent value, without calling the data layer", async () => {
    const res = await PATCH(patch({ consent: "true" }));
    expect(res.status).toBe(400);
    expect(setModelTrainingConsent).not.toHaveBeenCalled();
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(setModelTrainingConsent).mockResolvedValue({ ok: false, status: 401 });
    const res = await PATCH(patch({ consent: true }));
    expect(res.status).toBe(401);
  });

  it("passes a valid body through and echoes the new value", async () => {
    vi.mocked(setModelTrainingConsent).mockResolvedValue({ ok: true, data: { consent: true } });
    const res = await PATCH(patch({ consent: true }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ data: { consent: true } });
  });

  it("sets Retry-After on 429", async () => {
    vi.mocked(setModelTrainingConsent).mockResolvedValue({ ok: false, status: 429, retryAfter: 30_000 });
    const res = await PATCH(patch({ consent: true }));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
  });

  it("turns a thrown data-layer error into an opaque 500 and never leaks its message", async () => {
    vi.mocked(setModelTrainingConsent).mockRejectedValue(
      new Error("permission denied for column model_training_consent"),
    );
    const res = await PATCH(patch({ consent: true }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(JSON.stringify(json)).not.toContain("permission denied");
    expect(JSON.stringify(json)).not.toContain("model_training_consent");
  });
});
