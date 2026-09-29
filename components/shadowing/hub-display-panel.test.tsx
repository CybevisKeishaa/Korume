import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import pronunciationCopy from "@/messages/en/pronunciation.json";
import { HubDisplayPanel, type HubDisplayValue } from "./hub-display-panel";

const nav = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), search: "" }));
vi.mock("@/lib/i18n/navigation", () => ({ useRouter: () => ({ push: nav.push, refresh: nav.refresh }), usePathname: () => "/pronunciation" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(nav.search) }));

const labels = pronunciationCopy.hub.display;
const DEFAULTS: HubDisplayValue = { sort: "recommended", duration: null, hideCompleted: false };

function respond(ok: boolean) {
  const fetchMock = vi.fn().mockResolvedValue({ ok });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => { nav.push.mockReset(); nav.refresh.mockReset(); nav.search = ""; });
afterEach(() => vi.unstubAllGlobals());

async function open(value: HubDisplayValue = DEFAULTS) {
  const user = userEvent.setup();
  render(<HubDisplayPanel value={value} labels={labels} />);
  await user.click(screen.getByRole("button", { name: labels.trigger }));
  return user;
}

describe("HubDisplayPanel", () => {
  it("opens a named dialog with the two radio groups and the checkbox, starting from the applied view", async () => {
    await open({ sort: "shortest", duration: "over_30", hideCompleted: true });
    expect(screen.getByRole("dialog", { name: labels.title })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: labels.sort })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: labels.shortest })).toBeChecked();
    expect(screen.getByRole("radio", { name: labels.overThirty })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: labels.hideCompleted })).toBeChecked();
  });

  it("saves the choice to the profile and puts only non-defaults in the URL, keeping the search", async () => {
    nav.search = "q=ramen&filter=situation%3Arestaurant&sort=newest";
    const fetchMock = respond(true);
    const user = await open({ ...DEFAULTS, sort: "newest" });
    await user.click(screen.getByRole("radio", { name: labels.recommended }));
    await user.click(screen.getByRole("radio", { name: labels.tenToThirty }));
    await user.click(screen.getByRole("button", { name: labels.apply }));

    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({ pronunciationSort: "recommended", pronunciationDuration: "10_30", pronunciationHideCompleted: false });
    expect(nav.push).toHaveBeenCalledWith("/pronunciation?q=ramen&filter=situation%3Arestaurant&duration=10_30");
    // The router may cache the target from before the save; the page must re-read the profile.
    expect(nav.refresh).toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("spells every value out when the save fails, so the old profile cannot come back", async () => {
    respond(false);
    const user = await open({ sort: "shortest", duration: "under_10", hideCompleted: true });
    await user.click(screen.getByRole("button", { name: labels.reset }));
    expect(screen.getByRole("radio", { name: labels.recommended })).toBeChecked();
    expect(screen.getByRole("radio", { name: labels.anyDuration })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: labels.hideCompleted })).not.toBeChecked();
    await user.click(screen.getByRole("button", { name: labels.apply }));

    expect(nav.push).toHaveBeenCalledWith("/pronunciation?sort=recommended&duration=any&hideCompleted=false");
    expect(await screen.findByRole("status")).toHaveTextContent(labels.saveFailed);
  });

  it("treats a network failure like a refused save", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const user = await open();
    await user.click(screen.getByRole("button", { name: labels.apply }));
    expect(await screen.findByRole("status")).toHaveTextContent(labels.saveFailed);
    expect(nav.push).toHaveBeenCalledWith("/pronunciation?sort=recommended&duration=any&hideCompleted=false");
  });

  it("closes on Escape with focus back on its trigger, and forgets the cancelled draft", async () => {
    const user = userEvent.setup();
    render(<HubDisplayPanel value={DEFAULTS} labels={labels} />);
    // Taken before opening: the open dialog hides everything outside it from the tree.
    const trigger = screen.getByRole("button", { name: labels.trigger });
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getByRole("radio", { name: labels.shortest }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    expect(screen.getByRole("radio", { name: labels.recommended })).toBeChecked();
  });

  it("marks the trigger when the applied view is not the default", () => {
    const { rerender } = render(<HubDisplayPanel value={DEFAULTS} labels={labels} />);
    const trigger = screen.getByRole("button", { name: labels.trigger });
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger.className).not.toContain("bg-primary ");
    rerender(<HubDisplayPanel value={{ ...DEFAULTS, hideCompleted: true }} labels={labels} />);
    expect(trigger.className).toContain("bg-primary ");
  });
});
