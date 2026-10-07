import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type MockResult, type QueryCall } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimit } from "@/lib/rate-limit";
import { processAvatar } from "@/lib/profile/avatar";
import { resolveAvatarUrl } from "@/lib/profile/avatar-url";
import { updateMyPreferences } from "@/lib/data/preferences";
import { canonicalTimeZone } from "@/lib/time/study-day";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn() }));
vi.mock("@/lib/profile/avatar", () => ({ processAvatar: vi.fn() }));
vi.mock("@/lib/profile/avatar-url", () => ({ resolveAvatarUrl: vi.fn() }));
vi.mock("@/lib/data/preferences", () => ({ updateMyPreferences: vi.fn() }));

import { checkUsername, saveProfile, type SaveProfileInput } from "./profile-write";

const USER = { id: "11111111-1111-4111-8111-111111111111" };
const NEW_PATH = /^11111111-1111-4111-8111-111111111111\/profile\/[0-9a-f-]{36}\.webp$/;

const FIELDS = {
  displayName: " Keishaa ", username: "Keishaa_1", bio: "hi", country: "VN", timeZone: "Asia/Tokyo",
  nativeLanguage: "vi", targetJlptLevel: "N3", learningGoal: "anime", preferredPractices: ["kanji", "reading"],
};
const PREFS = { dailyMinutes: 30, readingTranslation: "reveal", readingFurigana: "hidden", companionEnabled: true };
const KEEP: SaveProfileInput = { fields: FIELDS, preferences: PREFS, avatar: { action: "keep" } };
const REPLACE: SaveProfileInput = {
  fields: FIELDS, preferences: PREFS, avatar: { action: "replace", bytes: new Uint8Array([1, 2, 3]), type: "image/jpeg" },
};

let events: string[];
let userCalls: QueryCall[];
let upload: ReturnType<typeof vi.fn>;
let remove: ReturnType<typeof vi.fn>;
let rpcImpl: (args: Record<string, unknown>) => MockResult;
let service: ReturnType<typeof createMockSupabase>;
let serviceTables: string[];

function wire(user: { id: string } | null = USER) {
  const client = createMockSupabase({
    user,
    tables: {
      users: (calls) => {
        userCalls.push(...calls);
        return { data: { avatar_url: "https://oauth/pic.png", avatar_path: "stored/path.webp" }, error: null };
      },
    },
  });
  vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>);
}

beforeEach(() => {
  vi.resetAllMocks();
  events = [];
  userCalls = [];
  serviceTables = [];
  upload = vi.fn(async () => { events.push("upload"); return { data: { path: "x" }, error: null }; });
  remove = vi.fn(async () => { events.push("remove"); return { data: [], error: null }; });
  rpcImpl = () => ({ data: null, error: null });
  const base = createMockSupabase({
    user: USER,
    tables: { users: () => ({ data: null, error: null }) },
    rpcs: { save_profile: (args) => { events.push("rpc"); return rpcImpl(args); } },
  });
  service = {
    ...base,
    from: ((table: string) => { serviceTables.push(table); return base.from(table); }) as typeof base.from,
    storage: { from: vi.fn(() => ({ upload, remove })) } as unknown as typeof base.storage,
  };
  vi.mocked(createServiceClient).mockReturnValue(service as unknown as ReturnType<typeof createServiceClient>);
  vi.mocked(rateLimit).mockReturnValue({ ok: true, retryAfter: 0 });
  vi.mocked(processAvatar).mockResolvedValue({ ok: true, webp: Buffer.from("webp") });
  vi.mocked(resolveAvatarUrl).mockImplementation(async ({ avatarPath, avatarUrl }) => (avatarPath ? `signed:${avatarPath}` : avatarUrl));
  wire();
});

const rpcArgs = () => service.rpcCalls?.[0]?.args;

describe("saveProfile", () => {
  it("401 and nothing written when signed out", async () => {
    wire(null);
    expect(await saveProfile(KEEP)).toEqual({ ok: false, status: 401 });
    expect(rateLimit).not.toHaveBeenCalled();
    expect(service.rpcCalls).toEqual([]);
    expect(upload).not.toHaveBeenCalled();
  });

  it("429 with Retry-After before any validation or work", async () => {
    vi.mocked(rateLimit).mockReturnValue({ ok: false, retryAfter: 4200 });
    expect(await saveProfile(REPLACE)).toEqual({ ok: false, status: 429, retryAfter: 4200 });
    expect(rateLimit).toHaveBeenCalledWith(`profile-save:${USER.id}`, { limit: 10, windowMs: 60_000 });
    expect(processAvatar).not.toHaveBeenCalled();
    expect(service.rpcCalls).toEqual([]);
  });

  it("400 with fields keyed by form field when profileFieldsSchema fails; nothing processed or written", async () => {
    const result = await saveProfile({ ...REPLACE, fields: { ...FIELDS, username: "ab", bio: "x".repeat(161), country: "ZZ" } });
    expect(result.ok).toBe(false);
    if (result.ok || result.status !== 400) throw new Error("expected 400");
    expect(Object.keys(result.fields).sort()).toEqual(["bio", "country", "username"]);
    expect(result.fields.username).toBe("format");
    expect(processAvatar).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
    expect(service.rpcCalls).toEqual([]);
  });

  it("400 when fields is not an object", async () => {
    const result = await saveProfile({ ...KEEP, fields: "nope" });
    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(service.rpcCalls).toEqual([]);
  });

  it.each([
    ["an out-of-range dailyMinutes", { ...PREFS, dailyMinutes: 7 }, "dailyMinutes"],
    ["an unknown readingTranslation", { ...PREFS, readingTranslation: "loud" }, "readingTranslation"],
    ["a non-boolean companionEnabled", { ...PREFS, companionEnabled: "yes" }, "companionEnabled"],
    ["a missing readingFurigana", { dailyMinutes: 30, readingTranslation: "reveal", companionEnabled: true }, "readingFurigana"],
  ])("400 on %s, validated with the same schema as /settings", async (_name, preferences, key) => {
    const result = await saveProfile({ ...KEEP, preferences });
    expect(result).toMatchObject({ ok: false, status: 400 });
    if (result.ok || result.status !== 400) throw new Error("expected 400");
    expect(Object.keys(result.fields)).toContain(key);
    expect(service.rpcCalls).toEqual([]);
  });

  it("keep: one save_profile call with the session user and validated values; no upload", async () => {
    const result = await saveProfile(KEEP);
    expect(result).toEqual({ ok: true, data: { avatarUrl: "signed:stored/path.webp" } });
    expect(rpcArgs()).toEqual({
      p_user: USER.id,
      p_fields: {
        displayName: "Keishaa", username: "keishaa_1", bio: "hi", country: "VN", timeZone: canonicalTimeZone("Asia/Tokyo"),
        nativeLanguage: "vi", targetJlptLevel: "N3", learningGoal: "anime", preferredPractices: ["kanji", "reading"],
      },
      p_prefs: PREFS,
      p_avatar_action: "keep",
      p_avatar_path: null,
    });
    expect(upload).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it("replace: processes, uploads to <user>/profile/<uuid>.webp (webp, no upsert), then saves with replace", async () => {
    const result = await saveProfile(REPLACE);
    expect(result.ok).toBe(true);
    expect(processAvatar).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]), "image/jpeg");
    const [path, body, options] = upload.mock.calls[0]!;
    expect(path).toMatch(NEW_PATH);
    expect(Buffer.isBuffer(body)).toBe(true);
    expect(options).toEqual({ contentType: "image/webp", upsert: false });
    expect(rpcArgs()).toMatchObject({ p_user: USER.id, p_avatar_action: "replace", p_avatar_path: path });
    expect(events).toEqual(["upload", "rpc"]);
  });

  it("RPC failure removes the NEW object, never an old one, and returns the error", async () => {
    rpcImpl = () => ({ data: null, error: { message: "boom", code: "XX000" } });
    await expect(saveProfile(REPLACE)).rejects.toMatchObject({ message: "boom" });
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith([upload.mock.calls[0]![0]]);
    expect(events).toEqual(["upload", "rpc", "remove"]);
  });

  it("23505 maps to 409 { username: taken } and still removes the new object", async () => {
    rpcImpl = () => ({ data: null, error: { message: "duplicate key", code: "23505" } });
    expect(await saveProfile(REPLACE)).toEqual({ ok: false, status: 409, fields: { username: "taken" } });
    expect(remove).toHaveBeenCalledWith([upload.mock.calls[0]![0]]);
  });

  it("an upload failure never reaches the database", async () => {
    upload.mockResolvedValue({ data: null, error: { message: "storage down" } });
    await expect(saveProfile(REPLACE)).rejects.toMatchObject({ message: "storage down" });
    expect(service.rpcCalls).toEqual([]);
  });

  it("success with a previous object removes it only AFTER the commit; a removal error is logged, not returned", async () => {
    rpcImpl = () => ({ data: "11111111-1111-4111-8111-111111111111/profile/old.webp", error: null });
    remove.mockImplementation(async () => { events.push("remove"); return { data: null, error: { message: "gone" } }; });
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await saveProfile(REPLACE);
    expect(result.ok).toBe(true);
    expect(events).toEqual(["upload", "rpc", "remove"]);
    expect(remove).toHaveBeenCalledWith(["11111111-1111-4111-8111-111111111111/profile/old.webp"]);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("remove: saves with remove and deletes the old object after the commit", async () => {
    rpcImpl = () => ({ data: "u/profile/old.webp", error: null });
    const result = await saveProfile({ ...KEEP, avatar: { action: "remove" } });
    expect(result.ok).toBe(true);
    expect(rpcArgs()).toMatchObject({ p_avatar_action: "remove", p_avatar_path: null });
    expect(events).toEqual(["rpc", "remove"]);
    expect(remove).toHaveBeenCalledWith(["u/profile/old.webp"]);
    expect(upload).not.toHaveBeenCalled();
  });

  it("keep with a returned previous path never deletes it", async () => {
    rpcImpl = () => ({ data: "u/profile/current.webp", error: null });
    await saveProfile(KEEP);
    expect(remove).not.toHaveBeenCalled();
  });

  it.each([
    ["too_large", 413],
    ["type", 415],
    ["pixels", 422],
    ["corrupt", 422],
  ] as const)("avatar rejection %s maps to %i with nothing uploaded or saved", async (reason, status) => {
    vi.mocked(processAvatar).mockResolvedValue({ ok: false, reason });
    expect(await saveProfile(REPLACE)).toEqual({ ok: false, status });
    expect(upload).not.toHaveBeenCalled();
    expect(service.rpcCalls).toEqual([]);
  });

  it("writes nothing outside save_profile: no table update/upsert/insert/delete, no updateMyPreferences", async () => {
    rpcImpl = () => ({ data: "u/profile/old.webp", error: null });
    await saveProfile(REPLACE);
    await saveProfile({ ...KEEP, avatar: { action: "remove" } });
    expect(userCalls.filter((c) => ["update", "upsert", "insert", "delete"].includes(c.op))).toEqual([]);
    expect(serviceTables).toEqual([]);
    expect(updateMyPreferences).not.toHaveBeenCalled();
    expect(service.rpcCalls?.every((c) => c.name === "save_profile")).toBe(true);
  });
});

describe("checkUsername", () => {
  function wireLookup(taken: boolean) {
    const calls: QueryCall[] = [];
    const lookup = createMockSupabase({
      user: USER,
      tables: { users: (c) => { calls.push(...c); return { data: taken ? [{ id: "someone-else" }] : [], error: null }; } },
    });
    vi.mocked(createServiceClient).mockReturnValue(lookup as unknown as ReturnType<typeof createServiceClient>);
    return calls;
  }

  it("401 when signed out; 429 when rate limited at 30/min", async () => {
    wire(null);
    expect(await checkUsername("keishaa")).toEqual({ ok: false, status: 401 });
    wire();
    vi.mocked(rateLimit).mockReturnValue({ ok: false, retryAfter: 1000 });
    expect(await checkUsername("keishaa")).toEqual({ ok: false, status: 429, retryAfter: 1000 });
    expect(rateLimit).toHaveBeenCalledWith(`username-check:${USER.id}`, { limit: 30, windowMs: 60_000 });
  });

  it("format and reserved are unavailable without touching the database", async () => {
    const calls = wireLookup(false);
    expect(await checkUsername("a")).toEqual({ ok: true, data: { available: false, reason: "format" } });
    expect(await checkUsername("Admin")).toEqual({ ok: true, data: { available: false, reason: "reserved" } });
    expect(calls).toEqual([]);
  });

  it("looks up the normalised value excluding the caller and returns only a flag", async () => {
    const calls = wireLookup(true);
    expect(await checkUsername(" Keishaa ")).toEqual({ ok: true, data: { available: false, reason: "taken" } });
    expect(calls).toContainEqual({ op: "select", columns: "id" });
    expect(calls).toContainEqual({ op: "eq", column: "username", value: "keishaa" });
    expect(calls).toContainEqual({ op: "neq", column: "id", value: USER.id });
    wireLookup(false);
    expect(await checkUsername("keishaa")).toEqual({ ok: true, data: { available: true } });
  });
});
