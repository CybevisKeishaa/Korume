import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@/test/render";
import type { KorumeThreadView } from "@/lib/korume/types";
import { ThreadMenu } from "./thread-menu";

const row = (id: string, title: string | null, updatedAt = "2026-10-02T00:00:00.000Z"): KorumeThreadView => ({ id, title, anchor: null, originRoute: null, updatedAt });
const page = (threads: KorumeThreadView[], nextCursor: string | null) => ({ ok: true, json: async () => ({ threads, nextCursor }) });
const open = () => userEvent.click(screen.getByRole("button", { name: /Past conversations|Cuộc trò chuyện/ }));

describe("ThreadMenu", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("opens past threads, offers a new conversation, and loads pages until the cursor runs out", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(page([row("b", "Older")], "c2")).mockResolvedValueOnce(page([row("c", "Oldest")], null)); vi.stubGlobal("fetch", fetch);
    render(<ThreadMenu onNewConversation={() => undefined} initialThreads={[row("a", "Topic particle")]} initialCursor="c1" />);
    await open();
    expect(screen.getByRole("link", { name: "New conversation" })).toHaveAttribute("href", "/en/korume/chat");
    expect(screen.getByRole("link", { name: /Topic particle/ })).toHaveAttribute("href", "/en/korume/chat?thread=a");
    await userEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByText("Older")).toBeInTheDocument();
    expect(String(fetch.mock.calls[0]?.[0])).toBe("/api/korume/threads?cursor=c1");
    await userEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByText("Oldest")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
    expect(screen.getByText("Topic particle")).toBeInTheDocument();
  });

  it.each([["a failed response", () => Promise.resolve({ ok: false, json: async () => ({}) })], ["a network error", () => Promise.reject(new TypeError("offline"))]])("keeps the list and the button after %s", async (_name, respond) => {
    vi.stubGlobal("fetch", vi.fn(respond));
    render(<ThreadMenu onNewConversation={() => undefined} initialThreads={[row("a", "Topic particle")]} initialCursor="c1" />);
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(screen.getByText("Topic particle")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Load more" })).toBeEnabled();
  });

  it("labels an untitled thread and formats dates in the app locale", async () => {
    render(<ThreadMenu onNewConversation={() => undefined} initialThreads={[row("a", null, "2026-10-02T12:00:00.000Z")]} initialCursor={null} />, { locale: "vi" });
    await open();
    const expected = new Intl.DateTimeFormat("vi", { dateStyle: "medium" }).format(new Date("2026-10-02T12:00:00.000Z"));
    expect(expected).not.toBe(new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date("2026-10-02T12:00:00.000Z")));
    expect(screen.getByText(expected)).toBeInTheDocument();
    expect(screen.getByText("Cuộc trò chuyện chưa có tên")).toBeInTheDocument();
  });
});
