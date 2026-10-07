import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@/test/render";
import type { GroundedEntity, KorumeMessageView, KorumeThreadDetail } from "@/lib/korume/types";
import { KorumeChatPage } from "./korume-chat-page";
const presence = vi.hoisted(() => vi.fn());
vi.mock("@/components/study-time/use-study-presence", () => ({ useStudyPresence: presence }));

const push = vi.fn(); const back = vi.fn(); const refresh = vi.fn();
vi.mock("@/lib/i18n", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/i18n")>()), useRouter: () => ({ push, back, refresh }) }));

const THREAD = "00000000-0000-4000-8000-000000000001";
const anchor = { videoId: "video", videoTitle: "Particles", lineId: "line", lineText: "私は学生です", translation: "I am a student.", startTime: 12, span: null };
const thread = (over: Partial<KorumeThreadDetail["thread"]> = {}): KorumeThreadDetail["thread"] => ({ id: THREAD, title: null, anchor: null, originRoute: null, updatedAt: "2026-10-03T00:00:00.000Z", ...over });
const answer = (turnId: string, grounding: GroundedEntity[]): KorumeMessageView => ({ id: `ai:${turnId}`, turnId, role: "assistant", text: "", answer: { blocks: [{ type: "paragraph", runs: [{ text: "Because." }] }] } as never, grounding, createdAt: "2026-10-03T00:00:01.000Z" });
const detailWith = (over: Partial<KorumeThreadDetail["thread"]> = {}, messages: KorumeMessageView[] = []): KorumeThreadDetail => ({ thread: thread(over), messages, pendingTurns: [] });
const page = (props: Partial<Parameters<typeof KorumeChatPage>[0]> = {}) => <KorumeChatPage detail={null} threads={[]} nextCursor={null} memory={null} disabled={false} notFound={false} {...props} />;
const referrer = (value: string) => Object.defineProperty(document, "referrer", { value, configurable: true });
const wa: GroundedEntity = { id: "ent:wa", label: "は", kind: "particle", seenCount: 3 };

describe("KorumeChatPage", () => {
  it("tracks the thread id when chat is enabled", () => {
    render(page({ detail: detailWith() }));
    expect(presence).toHaveBeenCalledWith({ surface: "korume_chat", contextId: THREAD, enabled: true });
  });
  beforeEach(() => { push.mockReset(); back.mockReset(); refresh.mockReset(); vi.stubGlobal("fetch", vi.fn()); });
  afterEach(() => { referrer(""); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("does not refresh for answers the server already rendered", () => {
    render(page({ detail: detailWith({}, [answer("t1", [wa])]) }));
    expect(refresh).not.toHaveBeenCalled();
  });

  it("renders the requested server detail without fetching on mount, and names Korume — never Sensei", () => {
    const question: KorumeMessageView = { id: "u1", turnId: "t1", role: "user", text: "Why は?", answer: null, grounding: null, createdAt: "2026-10-03T00:00:00.000Z" };
    render(page({ detail: detailWith({ originRoute: "/shadowing/video?line=line" }, [question, answer("t1", [])]) }));
    expect(screen.getByText("Why は?")).toBeInTheDocument();
    expect(screen.getByText("Because.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Korume Memory" })).toHaveAttribute("href", "/en/companion");
    expect(document.body.textContent).not.toMatch(/sensei/i);
    expect(screen.queryByText("Conversation Memory")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  describe("Back", () => {
    it("returns to the thread's origin route first", async () => {
      referrer(`${window.location.origin}/en/dashboard`);
      render(page({ detail: detailWith({ originRoute: "/shadowing/video?line=line" }) }));
      await userEvent.click(screen.getByRole("button", { name: /Back/ }));
      expect(push).toHaveBeenCalledWith("/shadowing/video?line=line"); expect(back).not.toHaveBeenCalled();
    });
    it("goes back through history when the previous page is in this app", async () => {
      referrer(`${window.location.origin}/en/vocab`);
      window.history.pushState({}, "", window.location.href);
      render(page());
      await userEvent.click(screen.getByRole("button", { name: /Back/ }));
      expect(back).toHaveBeenCalledOnce(); expect(push).not.toHaveBeenCalled();
    });
    it("goes to /dashboard from a fresh tab, even with a same-origin referrer — there is no entry to go back to", async () => {
      referrer(`${window.location.origin}/en/vocab`);
      vi.spyOn(window.history, "length", "get").mockReturnValue(1);
      render(page());
      await userEvent.click(screen.getByRole("button", { name: /Back/ }));
      expect(push).toHaveBeenCalledWith("/dashboard"); expect(back).not.toHaveBeenCalled();
      vi.restoreAllMocks();
    });
    it.each([["an external referrer", "https://example.com/somewhere"], ["no referrer", ""]])("never leaves the site with %s — /dashboard", async (_name, value) => {
      referrer(value);
      render(page());
      await userEvent.click(screen.getByRole("button", { name: /Back/ }));
      expect(push).toHaveBeenCalledWith("/dashboard"); expect(back).not.toHaveBeenCalled();
    });
  });

  it("uses the anchored placeholder for an anchored thread and the free one otherwise", () => {
    const { unmount } = render(page({ detail: detailWith({ anchor }) }));
    expect(screen.getByRole("textbox")).toHaveAttribute("placeholder", "Ask Korume about this sentence…");
    unmount();
    render(page());
    expect(screen.getByRole("textbox")).toHaveAttribute("placeholder", "Ask Korume anything about Japanese…");
  });

  describe("grounding line", () => {
    it("is absent when the latest answer carries no exposure", () => {
      render(page({ detail: detailWith({}, [answer("t1", [{ id: "ent:x", label: "x", kind: "particle" }])]) }));
      expect(screen.queryByText(/You've seen/)).toBeNull();
    });
    it("counts Shadowing LINES with a plural, from the latest answer", () => {
      render(page({ detail: detailWith({}, [answer("t1", [{ ...wa, seenCount: 1 }]), answer("t2", [wa])]) }));
      expect(screen.getByText("You've seen は in 3 Shadowing lines.")).toBeInTheDocument();
    });
    it("says N+ when the count was capped", () => {
      render(page({ detail: detailWith({}, [answer("t1", [{ ...wa, seenCount: 3000, seenCapped: true }])]) }));
      expect(screen.getByText("You've seen は in 3000+ Shadowing lines.")).toBeInTheDocument();
    });
  });

  it("adds the grounding of a turn answered on this page to the rail", async () => {
    vi.mocked(fetch).mockImplementationOnce(async (_url, init) => new Response(JSON.stringify({ message: answer(JSON.parse(String(init?.body)).turnId, [{ id: "ent:ga", label: "が", kind: "particle", seenCount: 2 }]) }), { status: 200 }));
    render(page({ detail: detailWith({}, [answer("t1", [wa])]) }));
    const rail = screen.getByRole("complementary");
    expect(within(rail).queryByText("が")).toBeNull();
    await userEvent.type(screen.getByRole("textbox"), "What about が?{Enter}");
    expect(await within(rail).findByText("が")).toBeInTheDocument();
    expect(within(rail).getByText("は")).toBeInTheDocument();
    // …and the cached server payload is dropped, so returning to this thread shows the new turn.
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("disabled → a Settings link and no composer; unavailable → no composer and no Settings link in the body", () => {
    const { unmount } = render(page({ disabled: true }));
    expect(screen.getAllByRole("link", { name: "Settings" })).toHaveLength(2); // header gear + the body link
    expect(screen.queryByRole("textbox")).toBeNull();
    unmount();
    render(page({ unavailable: true }));
    expect(screen.getAllByRole("link", { name: "Settings" })).toHaveLength(1);
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("dates the divider by the conversation's first message: Today only when it is today", async () => {
    const old = { ...answer("t1", []), createdAt: "2026-09-01T09:00:00.000Z" };
    const { unmount } = render(page({ detail: detailWith({}, [old]) }));
    const expected = new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(old.createdAt));
    expect(await screen.findByText(expected)).toBeInTheDocument();
    expect(screen.queryByText("Today")).toBeNull();
    unmount();
    render(page({ detail: detailWith({}, [{ ...answer("t2", []), createdAt: new Date().toISOString() }]) }));
    expect(await screen.findByText("Today")).toBeInTheDocument();
  });

  it("New conversation on an unsaved free chat starts over — the URL does not change, so the page resets itself", async () => {
    vi.mocked(fetch)
      .mockImplementationOnce(async () => new Response(JSON.stringify({ thread: thread() }), { status: 201 }))
      .mockImplementationOnce(async (_url, init) => new Response(JSON.stringify({ message: answer(JSON.parse(String(init?.body)).turnId, []) }), { status: 200 }));
    render(page());
    await userEvent.type(screen.getByRole("textbox"), "First question{Enter}");
    expect(await screen.findByText("Because.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Past conversations" }));
    await userEvent.click(screen.getByRole("link", { name: "New conversation" }));
    expect(screen.queryByText("Because.")).toBeNull();
    expect(screen.queryByText("First question")).toBeNull();
  });

  describe("a free chat's new thread", () => {
    const sendFirst = async () => {
      let created = "";
      vi.mocked(fetch)
        .mockImplementationOnce(async (_url, init) => { created = JSON.parse(String(init?.body)).threadId; return new Response(JSON.stringify({ thread: thread() }), { status: 201 }); })
        .mockImplementationOnce(async (_url, init) => new Response(JSON.stringify({ message: answer(JSON.parse(String(init?.body)).turnId, []) }), { status: 200 }));
      const view = render(page());
      await userEvent.type(screen.getByRole("textbox"), "First question{Enter}");
      expect(await screen.findByText("Because.")).toBeInTheDocument();
      return { view, created };
    };

    it("is put in the URL by REPLACE — reload shows it, Back does not land on an empty free chat", async () => {
      const replace = vi.spyOn(window.history, "replaceState");
      const push = vi.spyOn(window.history, "pushState");
      const { created } = await sendFirst();
      expect(created).toMatch(/^[0-9a-f-]{36}$/);
      expect(replace).toHaveBeenCalledWith(null, "", expect.objectContaining({ search: `?thread=${created}` }));
      expect(push).not.toHaveBeenCalled();
    });

    it("stays the same conversation when the server re-renders it under ?thread — no remount, focus kept", async () => {
      const { view, created } = await sendFirst();
      const box = screen.getByRole("textbox");
      box.focus();
      view.rerender(page({ detail: detailWith({ id: created }, [answer("server", [])]) }));
      expect(screen.getByRole("textbox")).toBe(box);
      expect(document.activeElement).toBe(box);
      expect(screen.getByText("First question")).toBeInTheDocument();
    });

    it("Back to a not-found ?thread is another conversation — the created one does not stay, nor return to the URL", async () => {
      const { view, created } = await sendFirst();
      view.rerender(page({ detail: detailWith({ id: created }, [answer("server", [])]) }));
      const replace = vi.spyOn(window.history, "replaceState");
      act(() => { window.dispatchEvent(new PopStateEvent("popstate")); });
      view.rerender(page({ notFound: true }));
      expect(screen.getByRole("status")).toHaveTextContent("That conversation could not be found");
      expect(screen.queryByText("First question")).toBeNull();
      expect(replace).not.toHaveBeenCalled();
    });
  });

  describe("focus", () => {
    const OTHER = "00000000-0000-4000-8000-000000000002";
    it("a first load does not take focus", () => {
      render(page({ detail: detailWith() }));
      expect(document.activeElement).toBe(document.body);
    });

    it("switching to another thread puts focus in the new conversation's composer, never on body", async () => {
      const view = render(page({ detail: detailWith({}, [answer("t1", [])]) }));
      const before = screen.getByRole("textbox");
      view.rerender(page({ detail: detailWith({ id: OTHER }, [{ ...answer("t9", []), answer: { blocks: [{ type: "paragraph", runs: [{ text: "Other thread." }] }] } as never }]) }));
      expect(await screen.findByText("Other thread.")).toBeInTheDocument();
      const after = screen.getByRole("textbox");
      expect(after).not.toBe(before);
      expect(document.activeElement).toBe(after);
    });
  });

  it("shows a quiet not-found line, never an error page", () => {
    render(page({ notFound: true }));
    expect(screen.getByRole("status")).toHaveTextContent("That conversation could not be found");
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });
});
