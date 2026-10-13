import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "./route";
import { setNewsletterOptIn } from "@/lib/data/newsletter";

vi.mock("@/lib/data/newsletter", () => ({
  setNewsletterOptIn: vi.fn(),
}));

const patch = (body: unknown) =>
  new Request("http://localhost/api/user/newsletter", { method: "PATCH", body: JSON.stringify(body) });

const patchRaw = (body: string) =>
  new Request("http://localhost/api/user/newsletter", { method: "PATCH", body });

beforeEach(() => vi.clearAllMocks());

describe("PATCH /api/user/newsletter", () => {
  it("rejects a body that is not valid JSON at all, without calling the data layer", async () => {
    const res = await PATCH(patchRaw("not json{"));
    expect(res.status).toBe(400);
    expect(setNewsletterOptIn).not.toHaveBeenCalled();
  });

  it("rejects a body missing optIn, without calling the data layer", async () => {
    const res = await PATCH(patch({}));
    expect(res.status).toBe(400);
    expect(setNewsletterOptIn).not.toHaveBeenCalled();
  });

  it("rejects a non-boolean optIn value, without calling the data layer", async () => {
    const res = await PATCH(patch({ optIn: "true" }));
    expect(res.status).toBe(400);
    expect(setNewsletterOptIn).not.toHaveBeenCalled();
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(setNewsletterOptIn).mockResolvedValue({ ok: false, status: 401 });
    const res = await PATCH(patch({ optIn: true }));
    expect(res.status).toBe(401);
  });

  it("passes a valid body through and echoes the new value", async () => {
    vi.mocked(setNewsletterOptIn).mockResolvedValue({ ok: true, data: { optedIn: true } });
    const res = await PATCH(patch({ optIn: true }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ data: { optedIn: true } });
  });

  it("ignores any email the client sends and passes only the boolean", async () => {
    vi.mocked(setNewsletterOptIn).mockResolvedValue({ ok: true, data: { optedIn: true } });
    const response = await PATCH(new Request("http://localhost/api/user/newsletter", {
      method: "PATCH",
      body: JSON.stringify({ optIn: true, email: "attacker@example.com" }),
    }));
    expect(response.status).toBe(200);
    expect(vi.mocked(setNewsletterOptIn)).toHaveBeenCalledWith({ optIn: true });
  });

  it("sets Retry-After on 429", async () => {
    vi.mocked(setNewsletterOptIn).mockResolvedValue({ ok: false, status: 429, retryAfter: 30_000 });
    const res = await PATCH(patch({ optIn: true }));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
  });

  it("turns a thrown data-layer error into an opaque 500 and never leaks its message", async () => {
    vi.mocked(setNewsletterOptIn).mockRejectedValue(
      new Error("permission denied for column newsletter_opt_in_at"),
    );
    const res = await PATCH(patch({ optIn: true }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(JSON.stringify(json)).not.toContain("permission denied");
    expect(JSON.stringify(json)).not.toContain("newsletter_opt_in_at");
  });
});
