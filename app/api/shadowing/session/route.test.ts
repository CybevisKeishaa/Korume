// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSession, listSessions, type CreateSessionResult } from "@/lib/data/shadowing";
import { GET, POST } from "./route";

vi.mock("@/lib/data/shadowing", () => ({ createSession: vi.fn(), listSessions: vi.fn() }));
const ID = "11111111-1111-4111-8111-111111111111";
const url = `http://localhost/api/shadowing/session?lineId=${ID}`;
function request(audio: Blob | string | null = new Blob(["wav"], { type: "audio/wav" }), videoId = ID) {
  const form = new FormData();
  form.set("videoId", videoId);
  form.set("lineId", ID);
  if (audio !== null) form.set("audio", audio);
  return new Request(url, { method: "POST", body: form });
}
function privateResponse(response: Response, status: number) {
  expect(response.status).toBe(status);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(createSession).mockResolvedValue({ ok: true, data: {
    id: ID, recordingPath: "u/take.wav", signedUrl: "https://signed", createdAt: "now",
  } });
});

describe("POST", () => {
  it.each(["text instead of file", null, new Blob([])])("rejects missing or non-file audio (%s)", async (audio) => {
    privateResponse(await POST(request(audio)), 400);
    expect(createSession).not.toHaveBeenCalled();
  });
  it("returns private 400 for malformed multipart data", async () => {
    privateResponse(await POST(new Request(url, { method: "POST", body: "not multipart" })), 400);
  });
  it("returns private 400 for invalid fields", async () => {
    privateResponse(await POST(request(new Blob(["wav"]), "invalid")), 400);
    expect(createSession).not.toHaveBeenCalled();
  });
  it.each([400, 401, 422, 429] as const)("returns private %s errors", async (status) => {
    const result: CreateSessionResult = status === 429
      ? { ok: false, status, retryAfter: 1500 } : { ok: false, status };
    vi.mocked(createSession).mockResolvedValue(result);
    const response = await POST(request());
    privateResponse(response, status);
    if (status === 429) expect(response.headers.get("Retry-After")).toBe("2");
  });
  it("returns private 201 and forwards the file", async () => {
    const data = { id: ID, recordingPath: "u/take.wav", signedUrl: "https://signed", createdAt: "now" };
    vi.mocked(createSession).mockResolvedValue({ ok: true, data });
    const response = await POST(request());
    privateResponse(response, 201);
    expect(await response.json()).toEqual({ data });
    expect(createSession).toHaveBeenCalledTimes(1);
    expect(createSession).toHaveBeenCalledWith({ videoId: ID, lineId: ID, audio: expect.any(Blob), pitchScore: undefined });
  });
});

describe("GET", () => {
  it("returns private invalid-line errors", async () => {
    privateResponse(await GET(new Request("http://localhost/api/shadowing/session")), 400);
  });
  it("returns private auth errors", async () => {
    vi.mocked(listSessions).mockResolvedValue({ ok: false, status: 401 });
    privateResponse(await GET(new Request(url)), 401);
  });
  it("returns private history", async () => {
    vi.mocked(listSessions).mockResolvedValue({ ok: true, data: [] });
    const response = await GET(new Request(url));
    privateResponse(response, 200);
    expect(await response.json()).toEqual({ data: [] });
    expect(listSessions).toHaveBeenCalledTimes(1);
    expect(listSessions).toHaveBeenCalledWith(ID);
  });
});
