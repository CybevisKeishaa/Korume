import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";

const mocks = vi.hoisted(() => ({ gate: vi.fn(), getThread: vi.fn(), listThreads: vi.fn(), memory: vi.fn(), redirect: vi.fn(), props: [] as unknown[] }));
vi.mock("@/lib/korume/gate", () => ({ korumeGate: mocks.gate }));
vi.mock("@/lib/data/korume", () => ({ getThread: mocks.getThread, listThreads: mocks.listThreads, smallMemoryFor: mocks.memory }));
vi.mock("@/lib/i18n", () => ({ redirect: mocks.redirect }));
vi.mock("@/components/korume/korume-chat-page", () => ({ KorumeChatPage: (props: unknown) => { mocks.props.push(props); return <pre data-testid="props">{JSON.stringify(props)}</pre>; } }));

import KorumeChatRoute from "./page";

const request = { searchParams: {}, params: { locale: "en" as const } };
const ID = "00000000-0000-4000-8000-00000000000a"; const GONE = "00000000-0000-4000-8000-00000000000b";
const detail = { thread: { id: "a", title: null, anchor: null, originRoute: null, updatedAt: "2026-10-03T00:00:00.000Z" }, messages: [], pendingTurns: [] };

describe("KorumeChatRoute", () => {
  it("fails closed for disabled and unavailable before any thread, list, or memory read", async () => {
    for (const kind of ["disabled", "unavailable"] as const) {
      mocks.gate.mockResolvedValueOnce({ kind });
      render(await KorumeChatRoute(request));
      const props = JSON.parse(screen.getAllByTestId("props").at(-1)?.textContent ?? "{}");
      expect(props).toMatchObject({ disabled: kind === "disabled", unavailable: kind === "unavailable" });
    }
    expect(mocks.getThread).not.toHaveBeenCalled(); expect(mocks.listThreads).not.toHaveBeenCalled(); expect(mocks.memory).not.toHaveBeenCalled();
  });
  it("redirects an unauthenticated learner to the localized login", async () => {
    mocks.gate.mockResolvedValueOnce({ kind: "unauthorized" });
    await KorumeChatRoute(request);
    expect(mocks.redirect).toHaveBeenCalledWith({ href: "/login", locale: "en" });
  });
  it("uses an existing thread DTO without functions and falls back quietly when it is missing", async () => {
    mocks.gate.mockResolvedValue({ kind: "ok", userId: "u", supabase: {} });
    mocks.getThread.mockResolvedValueOnce({ kind: "ok", detail }).mockResolvedValueOnce({ kind: "not_found" });
    mocks.listThreads.mockResolvedValue({ kind: "ok", threads: [], nextCursor: null }); mocks.memory.mockResolvedValue(null);
    const element = await KorumeChatRoute({ ...request, searchParams: { thread: ID } });
    // Not keyed on the server: KorumeChatPage keys its own conversation (a free chat's new thread must not remount).
    expect(element.key).toBeNull();
    render(element);
    // The real props object, as React would hand it across the RSC boundary: a function here blanks the page.
    expect(() => structuredClone(mocks.props.at(-1))).not.toThrow();
    expect(mocks.props.at(-1)).toMatchObject({ detail, notFound: false });
    const gone = await KorumeChatRoute({ ...request, searchParams: { thread: GONE } });
    render(gone);
    expect(JSON.parse(screen.getAllByTestId("props").at(-1)?.textContent ?? "{}")).toMatchObject({ detail: null, notFound: true });
  });
  it("treats a malformed id as not found without reading, and survives failing reads as free chat", async () => {
    mocks.gate.mockResolvedValue({ kind: "ok", userId: "u", supabase: {} });
    mocks.getThread.mockReset(); mocks.listThreads.mockReset(); mocks.memory.mockResolvedValue(null);
    mocks.listThreads.mockResolvedValue({ kind: "ok", threads: [], nextCursor: null });
    for (const thread of ["abc", ["a", "b"]]) {
      await KorumeChatRoute({ ...request, searchParams: { thread } });
      expect(mocks.props.at(-1)).toMatchObject({ detail: null, notFound: true });
    }
    expect(mocks.getThread).not.toHaveBeenCalled();
    mocks.getThread.mockRejectedValueOnce(new Error("db")); mocks.listThreads.mockRejectedValueOnce(new Error("db"));
    render(await KorumeChatRoute({ ...request, searchParams: { thread: ID } }));
    expect(mocks.props.at(-1)).toMatchObject({ detail: null, notFound: true, threads: [], nextCursor: null });
  });
});
