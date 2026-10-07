// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authorizeProfileSave, saveProfile } from "@/lib/data/profile-write";

vi.mock("@/lib/data/profile-write", () => ({ saveProfile: vi.fn(), authorizeProfileSave: vi.fn() }));

import { PATCH } from "./route";

const FIELDS = { displayName: "K", username: "keishaa", bio: "", country: null, timeZone: "Asia/Tokyo", nativeLanguage: null, targetJlptLevel: null, learningGoal: "", preferredPractices: [] };
const PREFERENCES = { dailyMinutes: 15, readingTranslation: "always", readingFurigana: "adaptive", companionEnabled: true };
const PROFILE = { fields: FIELDS, preferences: PREFERENCES, avatar: "keep" };
const SESSION = { id: "session-user" };
let formDataSpy: ReturnType<typeof vi.spyOn> | null = null;

function patch(profile: unknown, file?: File, headers: Record<string, string> = {}, raw?: string) {
  const form = new FormData();
  form.set("profile", raw ?? JSON.stringify(profile));
  if (file) form.set("avatar", file);
  // Node does not add Content-Length to a Request built in-process; real clients always send it. "" removes it.
  const merged: Record<string, string> = { "content-length": "1000", ...headers };
  for (const key of Object.keys(merged)) if (merged[key] === "") delete merged[key];
  const request = new Request("http://x/api/profile", { method: "PATCH", body: form, headers: merged });
  formDataSpy = vi.spyOn(request, "formData");
  return PATCH(request);
}
const photo = () => new File([new Uint8Array([1, 2, 3])], "me.jpg", { type: "image/jpeg" });

beforeEach(() => {
  vi.resetAllMocks();
  formDataSpy = null;
  vi.mocked(authorizeProfileSave).mockResolvedValue({ ok: true, user: SESSION });
  vi.mocked(saveProfile).mockResolvedValue({ ok: true, data: { avatarUrl: "https://signed/a.webp" } });
});

describe("PATCH /api/profile", () => {
  it("200 { data: { avatarUrl } }, passing exactly the validated parts and no user id", async () => {
    const res = await patch(PROFILE);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { avatarUrl: "https://signed/a.webp" } });
    expect(saveProfile).toHaveBeenCalledTimes(1);
    expect(vi.mocked(saveProfile).mock.calls[0]![0]).toStrictEqual({ fields: FIELDS, preferences: PREFERENCES, avatar: { action: "keep" } });
    // the identity is the authorised session user, handed over as-is
    expect(vi.mocked(saveProfile).mock.calls[0]![1]).toBe(SESSION);
  });

  it("a user id in the body is rejected, never forwarded (the session is the only identity)", async () => {
    const res = await patch({ ...PROFILE, userId: "someone-else" });
    expect(res.status).toBe(400);
    expect(saveProfile).not.toHaveBeenCalled();
  });

  it.each([
    ["not JSON", undefined, "{nope"],
    ["an unknown avatar action", { ...PROFILE, avatar: "wipe" }, undefined],
    ["a missing preferences object", { ...PROFILE, preferences: undefined }, undefined],
  ])("400 on %s", async (_name, profile, raw) => {
    const res = await patch(profile, undefined, {}, raw);
    expect(res.status).toBe(400);
    expect(saveProfile).not.toHaveBeenCalled();
  });

  it("the route's own 400 uses the same { error, fields: Record<string,string> } shape", async () => {
    const res = await patch({ ...PROFILE, avatar: "wipe" });
    expect(await res.json()).toEqual({ error: "Invalid input", fields: { avatar: expect.any(String) } });
  });

  it("400 when the profile part is missing or the body is not multipart", async () => {
    const empty = await PATCH(new Request("http://x/api/profile", { method: "PATCH", body: new FormData(), headers: { "content-length": "10" } }));
    expect(empty.status).toBe(400);
    const json = await PATCH(new Request("http://x/api/profile", { method: "PATCH", body: "{}", headers: { "content-type": "application/json", "content-length": "2" } }));
    expect(json.status).toBe(400);
    expect(saveProfile).not.toHaveBeenCalled();
  });

  it("400 for replace without a file and for a file without replace", async () => {
    expect((await patch({ ...PROFILE, avatar: "replace" })).status).toBe(400);
    expect((await patch(PROFILE, photo())).status).toBe(400);
    expect((await patch({ ...PROFILE, avatar: "remove" }, photo())).status).toBe(400);
    expect(saveProfile).not.toHaveBeenCalled();
  });

  it("replace passes the file bytes and declared type", async () => {
    expect((await patch({ ...PROFILE, avatar: "replace" }, photo())).status).toBe(200);
    const input = vi.mocked(saveProfile).mock.calls[0]![0];
    expect(input.avatar).toEqual({ action: "replace", bytes: new Uint8Array([1, 2, 3]), type: "image/jpeg" });
  });

  it("remove passes the remove action", async () => {
    await patch({ ...PROFILE, avatar: "remove" });
    expect(vi.mocked(saveProfile).mock.calls[0]![0].avatar).toEqual({ action: "remove" });
  });

  it("411 when Content-Length is missing (a chunked body) or not a number; nothing is read", async () => {
    expect((await patch(PROFILE, undefined, { "content-length": "" })).status).toBe(411);
    expect((await patch(PROFILE, undefined, { "content-length": "abc" })).status).toBe(411);
    expect(authorizeProfileSave).not.toHaveBeenCalled();
    expect(formDataSpy).not.toHaveBeenCalled();
    expect(saveProfile).not.toHaveBeenCalled();
  });

  it("413 on a declared body larger than the avatar budget, before auth or parsing", async () => {
    const res = await patch(PROFILE, undefined, { "content-length": String(3 * 1024 * 1024) });
    expect(res.status).toBe(413);
    expect(authorizeProfileSave).not.toHaveBeenCalled();
    expect(formDataSpy).not.toHaveBeenCalled();
  });

  it("401 when signed out, without ever reading the body", async () => {
    vi.mocked(authorizeProfileSave).mockResolvedValue({ ok: false, status: 401 });
    expect((await patch(PROFILE)).status).toBe(401);
    expect(formDataSpy).not.toHaveBeenCalled();
    expect(saveProfile).not.toHaveBeenCalled();
  });

  it("429 with Retry-After, without ever reading the body", async () => {
    vi.mocked(authorizeProfileSave).mockResolvedValue({ ok: false, status: 429, retryAfter: 4200 });
    const res = await patch(PROFILE);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("5");
    expect(formDataSpy).not.toHaveBeenCalled();
    expect(saveProfile).not.toHaveBeenCalled();
  });

  it.each([
    [{ ok: false, status: 413 }, 413],
    [{ ok: false, status: 415 }, 415],
    [{ ok: false, status: 422 }, 422],
  ] as const)("maps %j to %i", async (result, status) => {
    vi.mocked(saveProfile).mockResolvedValue(result);
    expect((await patch(PROFILE)).status).toBe(status);
  });

  it("409 carries { fields: { username: taken } }", async () => {
    vi.mocked(saveProfile).mockResolvedValue({ ok: false, status: 409, fields: { username: "taken" } });
    const res = await patch(PROFILE);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Username taken", fields: { username: "taken" } });
  });

  it("400 from the data layer carries { error, fields }", async () => {
    vi.mocked(saveProfile).mockResolvedValue({ ok: false, status: 400, fields: { bio: "too_long" } });
    const res = await patch(PROFILE);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid input", fields: { bio: "too_long" } });
  });

  it("500 with an opaque body when the data layer throws", async () => {
    vi.mocked(saveProfile).mockRejectedValue(new Error("secret detail"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await patch(PROFILE);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret");
    spy.mockRestore();
  });
});
