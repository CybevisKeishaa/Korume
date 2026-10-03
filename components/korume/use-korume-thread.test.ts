import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "@testing-library/react";
import { renderHook } from "@/test/render";
import type { KorumeThreadDetail } from "@/lib/korume/types";
import { POLL_LIMIT_MS, POLL_MS, useKorumeThread } from "./use-korume-thread";

const ANCHOR = { videoId: "v0000000-0000-4000-8000-000000000001", lineId: "l0000000-0000-4000-8000-000000000001", span: null };
const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
const answer = (turnId: string) => ({ id: `ai:${turnId}`, turnId, role: "assistant", text: "Because.", answer: null, grounding: null, createdAt: "2026-10-03T00:00:00Z" });
const thread = { id: "x", title: null, anchor: null, originRoute: null, updatedAt: "x" };

let fetchMock: ReturnType<typeof vi.fn>;
const calls = () => fetchMock.mock.calls.map(([url, init]) => [String(url), init?.method ?? "GET", init?.body ? JSON.parse(String(init.body)) : null]);

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("useKorumeThread", () => {
  it("creates the thread on the first send, then posts the turn, then never re-creates it", async () => {
    fetchMock
      .mockResolvedValueOnce(json(201, { thread }))
      .mockImplementationOnce(async (_u: string, init: RequestInit) => json(200, { message: answer(JSON.parse(String(init.body)).turnId) }))
      .mockImplementationOnce(async (_u: string, init: RequestInit) => json(200, { message: answer(JSON.parse(String(init.body)).turnId) }));
    const { result } = renderHook(() => useKorumeThread({ anchor: ANCHOR }));
    const threadId = result.current.threadId;
    await act(() => result.current.send("Why は?"));
    await act(() => result.current.send("And が?"));
    const [create, turn1, turn2] = calls();
    expect(create).toEqual(["/api/korume/threads", "POST", { threadId, videoId: ANCHOR.videoId, lineId: ANCHOR.lineId }]);
    expect(turn1?.[0]).toBe(`/api/korume/threads/${threadId}/turns`);
    expect(turn1?.[2]).toMatchObject({ text: "Why は?", locale: "en" });
    expect(turn2?.[2].turnId).not.toBe(turn1?.[2].turnId);
    expect(calls()).toHaveLength(3);
    expect(result.current.messages.map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant"]);
  });

  it("retries a lost thread POST with the same thread id and the same turn id", async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("network"))
      .mockResolvedValueOnce(json(200, { thread }))
      .mockImplementationOnce(async (_u: string, init: RequestInit) => json(200, { message: answer(JSON.parse(String(init.body)).turnId) }));
    const { result } = renderHook(() => useKorumeThread({ anchor: ANCHOR }));
    await act(() => result.current.send("Why は?"));
    expect(result.current.pending?.status).toBe("failed");
    const firstTurn = result.current.pending?.turnId;
    await act(() => result.current.retry());
    const [lost, again, turn] = calls();
    expect(again?.[2].threadId).toBe(lost?.[2].threadId);
    expect(turn?.[2].turnId).toBe(firstTurn);
    expect(result.current.pending).toBeNull();
  });

  it("resends the same turn id after a 502", async () => {
    fetchMock.mockResolvedValueOnce(json(201, { thread })).mockResolvedValueOnce(json(502, { error: "answer_failed", retryable: true }));
    const { result } = renderHook(() => useKorumeThread({ anchor: null }));
    await act(() => result.current.send("Q"));
    const failed = result.current.pending;
    expect(failed?.status).toBe("failed");
    fetchMock.mockImplementationOnce(async (_u: string, init: RequestInit) => json(200, { message: answer(JSON.parse(String(init.body)).turnId) }));
    await act(() => result.current.retry());
    expect(calls()[2]?.[2].turnId).toBe(failed?.turnId);
  });

  it("polls a 202 every 2 s and stops when the answer appears", async () => {
    vi.useFakeTimers();
    let turnId = "";
    fetchMock.mockResolvedValueOnce(json(201, { thread }))
      .mockImplementationOnce(async (_u: string, init: RequestInit) => { turnId = JSON.parse(String(init.body)).turnId; return json(202, { pending: true }); });
    const { result } = renderHook(() => useKorumeThread({ anchor: null }));
    await act(() => result.current.send("Q"));
    expect(result.current.pending?.status).toBe("running");
    const detail = (done: boolean): KorumeThreadDetail => ({
      thread, pendingTurns: done ? [] : [{ turnId, status: "running" }],
      messages: [{ id: "u", turnId, role: "user", text: "Q", answer: null, grounding: null, createdAt: "x" }, ...(done ? [answer(turnId) as never] : [])],
    });
    fetchMock.mockResolvedValueOnce(json(200, detail(false))).mockResolvedValueOnce(json(200, detail(true)));
    await act(async () => { await vi.advanceTimersByTimeAsync(POLL_MS); });
    expect(result.current.pending?.status).toBe("running");
    await act(async () => { await vi.advanceTimersByTimeAsync(POLL_MS); });
    expect(result.current.pending).toBeNull();
    expect(result.current.messages.at(-1)?.role).toBe("assistant");
    const polls = calls().filter(([, m]) => m === "GET").length;
    await act(async () => { await vi.advanceTimersByTimeAsync(POLL_MS * 3); });
    expect(calls().filter(([, m]) => m === "GET")).toHaveLength(polls);
  });

  it("turns a poll into Try again when the server says retryable, or after the limit", async () => {
    vi.useFakeTimers();
    const detail = (turnId: string, status: "running" | "retryable"): KorumeThreadDetail => ({
      thread, pendingTurns: [{ turnId, status }], messages: [{ id: "u", turnId, role: "user", text: "Q", answer: null, grounding: null, createdAt: "x" }],
    });
    const { result } = renderHook(() => useKorumeThread({ anchor: null, initial: detail("t1", "running") }));
    expect(result.current.pending).toEqual({ turnId: "t1", text: "Q", status: "running" });
    fetchMock.mockResolvedValueOnce(json(200, detail("t1", "retryable")));
    await act(async () => { await vi.advanceTimersByTimeAsync(POLL_MS); });
    expect(result.current.pending?.status).toBe("retryable");

    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => json(200, detail("t2", "running")));
    const second = renderHook(() => useKorumeThread({ anchor: null, initial: detail("t2", "running") }));
    await act(async () => { await vi.advanceTimersByTimeAsync(POLL_LIMIT_MS + POLL_MS); });
    expect(second.result.current.pending?.status).toBe("retryable");
  });

  it("maps each refusal to its notice", async () => {
    const cases: [Response, unknown][] = [
      [json(402, { error: "quota_exhausted", reason: "free_daily_limit", limit: 7, resetsAt: "R" }), { kind: "free_daily_limit", limit: 7, resetsAt: "R" }],
      [json(402, { error: "quota_exhausted", reason: "plus_credits_exhausted", resetsAt: "R" }), { kind: "plus_credits_exhausted", resetsAt: "R" }],
      [json(429, { error: "rate_limited" }, { "Retry-After": "7" }), { kind: "slow_down", retryAfterSeconds: 7 }],
      [json(503, { error: "ai_unavailable", reason: "budget" }), { kind: "resting" }],
      [json(409, { error: "turn_conflict" }), { kind: "conflict" }],
      [json(403, { error: "companion_disabled" }), { kind: "disabled" }],
    ];
    for (const [response, notice] of cases) {
      fetchMock.mockReset();
      fetchMock.mockResolvedValueOnce(json(201, { thread })).mockResolvedValueOnce(response);
      const { result } = renderHook(() => useKorumeThread({ anchor: null }));
      await act(() => result.current.send("Q"));
      expect(result.current.notice).toEqual(notice);
    }
  });
});
