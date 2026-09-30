import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, PUT } from "./route";
import { setCollectionSaved } from "@/lib/data/collections";

vi.mock("@/lib/data/collections", () => ({ setCollectionSaved: vi.fn() }));

const COLLECTION_ID = "a0000000-0000-0000-0000-000000000009";
const request = (method: string) => new Request(`http://localhost/api/collections/${COLLECTION_ID}/save`, { method });

beforeEach(() => vi.clearAllMocks());

describe("/api/collections/[id]/save", () => {
  it("rejects a malformed id before touching the data layer", async () => {
    const response = await PUT(request("PUT"), { params: { id: "not-a-uuid" } });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid id" });
    expect(setCollectionSaved).not.toHaveBeenCalled();
  });

  it("PUT saves and DELETE unsaves, each reporting the resulting state", async () => {
    vi.mocked(setCollectionSaved).mockResolvedValue({ ok: true });

    const saved = await PUT(request("PUT"), { params: { id: COLLECTION_ID } });
    expect(saved.status).toBe(200);
    await expect(saved.json()).resolves.toEqual({ data: { saved: true } });
    expect(setCollectionSaved).toHaveBeenLastCalledWith(COLLECTION_ID, true);

    const unsaved = await DELETE(request("DELETE"), { params: { id: COLLECTION_ID } });
    await expect(unsaved.json()).resolves.toEqual({ data: { saved: false } });
    expect(setCollectionSaved).toHaveBeenLastCalledWith(COLLECTION_ID, false);
  });

  it.each([
    [{ ok: false, status: 401 } as const, 401, "Unauthorized"],
    [{ ok: false, status: 404 } as const, 404, "Not found"],
  ])("passes a refusal through rather than reporting success (%o)", async (result, status, error) => {
    vi.mocked(setCollectionSaved).mockResolvedValue(result);

    const response = await PUT(request("PUT"), { params: { id: COLLECTION_ID } });
    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({ error });
  });

  it("returns 429 with Retry-After in whole seconds", async () => {
    vi.mocked(setCollectionSaved).mockResolvedValue({ ok: false, status: 429, retryAfter: 4_200 });

    const response = await PUT(request("PUT"), { params: { id: COLLECTION_ID } });
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("5");
  });

  it("returns an opaque JSON 500 when saving fails unexpectedly", async () => {
    vi.mocked(setCollectionSaved).mockRejectedValueOnce(new Error("Supabase unavailable"));

    const response = await PUT(request("PUT"), { params: { id: COLLECTION_ID } });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Something went wrong. Please try again." });
  });
});
