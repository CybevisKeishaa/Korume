import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import { SaveToggle, SavedCardsProvider } from "./save-toggle";

const LINE = "11111111-1111-4111-8111-111111111111";
const ok = (status: number, body?: unknown) => Promise.resolve({ ok: true, status, json: async () => body } as Response);
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

afterEach(() => vi.unstubAllGlobals());

describe("SaveToggle", () => {
  it("starts pressed for a saved card matched by kind|lineId|normalizeRef — a width variant counts", () => {
    render(<SaveToggle sourceKind="vocabulary" lineId={LINE} targetWord="カタカナ" savedCards={[{ cardId: "c-1", kind: "vocabulary", lineId: LINE, ref: "ｶﾀｶﾅ" }]} />);
    expect(screen.getByRole("button", { name: "Remove カタカナ from saved" })).toHaveAttribute("aria-pressed", "true");
  });

  it("does not match a card of another kind or another line", () => {
    render(
      <SaveToggle
        sourceKind="vocabulary"
        lineId={LINE}
        targetWord="注文"
        savedCards={[{ cardId: "c-1", kind: "expression", lineId: LINE, ref: "注文" }, { cardId: "c-2", kind: "vocabulary", lineId: "other", ref: "注文" }]}
      />,
    );
    expect(screen.getByRole("button", { name: "Save 注文" })).toHaveAttribute("aria-pressed", "false");
  });

  it("POSTs the exact body, presses on 201, then DELETEs that card id and unpresses on 204", async () => {
    const fetchMock = vi.fn().mockReturnValueOnce(ok(201, { data: { id: "c-9" } })).mockReturnValueOnce(ok(204));
    vi.stubGlobal("fetch", fetchMock);
    render(<SaveToggle sourceKind="expression" lineId={LINE} targetWord="失礼します" savedCards={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Save 失礼します" }));
    await flush();
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/mining", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ lineId: LINE, targetWord: "失礼します", sourceKind: "expression" }),
    }));
    const pressed = screen.getByRole("button", { name: "Remove 失礼します from saved" });
    expect(pressed).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(pressed);
    await flush();
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/mining/c-9", { method: "DELETE" });
    expect(screen.getByRole("button", { name: "Save 失礼します" })).toHaveAttribute("aria-pressed", "false");
  });

  it("treats 200 (already saved) like 201", async () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValueOnce(ok(200, { data: { id: "c-3" } })));
    render(<SaveToggle sourceKind="vocabulary" lineId={LINE} targetWord="注文" savedCards={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Save 注文" }));
    await flush();
    expect(screen.getByRole("button", { name: "Remove 注文 from saved" })).toHaveAttribute("aria-pressed", "true");
  });

  it("is aria-busy while in flight and ignores a second click", async () => {
    let resolve!: (value: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>((done) => { resolve = done; }));
    vi.stubGlobal("fetch", fetchMock);
    render(<SaveToggle sourceKind="vocabulary" lineId={LINE} targetWord="注文" savedCards={[]} />);
    const button = screen.getByRole("button", { name: "Save 注文" });
    fireEvent.click(button);
    await flush();
    expect(button).toHaveAttribute("aria-busy", "true");
    fireEvent.click(button);
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolve({ ok: true, status: 201, json: async () => ({ data: { id: "c-1" } }) } as Response);
    await flush();
    expect(button).not.toHaveAttribute("aria-busy");
  });

  it("under one provider, two toggles for the same word share one saved state (cards view and list view)", async () => {
    const fetchMock = vi.fn().mockReturnValueOnce(ok(201, { data: { id: "c-9" } })).mockReturnValueOnce(ok(204));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <SavedCardsProvider savedCards={[]}>
        <div data-testid="cards"><SaveToggle sourceKind="vocabulary" lineId={LINE} targetWord="注文" savedCards={[]} /></div>
        <div data-testid="list"><SaveToggle sourceKind="vocabulary" lineId={LINE} targetWord="注文" savedCards={[]} /></div>
      </SavedCardsProvider>,
    );
    const toggles = screen.getAllByRole("button", { name: "Save 注文" });
    expect(toggles).toHaveLength(2);
    fireEvent.click(toggles[0] as HTMLElement);
    await flush();
    expect(screen.getAllByRole("button", { name: "Remove 注文 from saved" })).toHaveLength(2);
    fireEvent.click(screen.getAllByRole("button", { name: "Remove 注文 from saved" })[1] as HTMLElement);
    await flush();
    expect(fetchMock).toHaveBeenLastCalledWith("/api/mining/c-9", { method: "DELETE" });
    expect(screen.getAllByRole("button", { name: "Save 注文" })).toHaveLength(2);
  });

  it("reverts and shows the error text when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({}) }));
    render(<SaveToggle sourceKind="vocabulary" lineId={LINE} targetWord="注文" savedCards={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Save 注文" }));
    await flush();
    expect(screen.getByRole("button", { name: "Save 注文" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("alert")).toHaveTextContent("Could not save. Try again.");
  });
});
