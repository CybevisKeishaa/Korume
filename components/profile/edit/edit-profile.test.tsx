import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { act, fireEvent } from "@testing-library/react";
import { render, screen, within } from "@/test/render";
import en from "@/messages/en/profile.json";
import { DEFAULT_PREFERENCES } from "@/lib/preferences/options";
import { makeView } from "../view-fixture";
import { EditProfile } from "./edit-profile";

const copy = en.edit;

const push = vi.fn();
const replace = vi.fn();
const refresh = vi.fn();
const setLocal = vi.fn();
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push, replace, refresh }),
  usePathname: () => "/profile/edit",
}));
vi.mock("@/components/providers/preferences-provider", () => ({
  usePreferences: () => ({ preferences: DEFAULT_PREFERENCES, setLocal }),
}));

let fetchMock: ReturnType<typeof vi.fn>;
let urlCount = 0;
const createObjectURL = vi.fn(() => `blob:local-${++urlCount}`);
const revokeObjectURL = vi.fn();

const json = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

beforeEach(() => {
  urlCount = 0;
  for (const m of [push, replace, refresh, setLocal, createObjectURL, revokeObjectURL]) m.mockClear();
  fetchMock = vi.fn(async (url: string) =>
    String(url).startsWith("/api/profile/username") ? json(200, { data: { available: true } }) : json(200, { data: { avatarUrl: null } }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL }));
});
afterEach(() => {
  Reflect.deleteProperty(window.history, "length");
  window.history.replaceState(null, "");
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const photo = () => new File([new Uint8Array([1, 2, 3])], "me.png", { type: "image/png" });
const profileCalls = () => fetchMock.mock.calls.filter(([url]) => url === "/api/profile") as unknown as [string, RequestInit][];

async function type(label: string, value: string) {
  const user = userEvent.setup();
  const input = field(label);
  await user.clear(input);
  if (value) await user.type(input, value);
}

describe("EditProfile", () => {
  it("starts from the saved profile and previews it through the identity card", () => {
    render(<EditProfile view={makeView()} />);
    expect(field(copy.fields.displayName).value).toBe("Keishaa");
    expect(field(copy.fields.username).value).toBe("keishaa");
    expect(field(copy.fields.bio).value).toBe("Learning slowly.");
    const preview = screen.getByRole("region", { name: "Keishaa" });
    expect(within(preview).getByText("@keishaa")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: copy.save })).toBeInTheDocument();
  });

  it("updates the preview from unsaved typing, with the handle normalised", async () => {
    render(<EditProfile view={makeView()} />);
    await type(copy.fields.displayName, "Mika");
    await type(copy.fields.username, "  Mika_1");
    await type(copy.fields.bio, "New bio");
    const preview = screen.getByRole("region", { name: "Mika" });
    expect(within(preview).getByText("@mika_1")).toBeInTheDocument();
    expect(within(preview).getByText("New bio")).toBeInTheDocument();
  });

  it("checks username availability after 400 ms and shows taken on the field", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(async () => json(200, { data: { available: false, reason: "taken" } }));
    render(<EditProfile view={makeView()} />);
    fireEvent.change(field(copy.fields.username), { target: { value: "mika_1" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(399); });
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(2); });
    expect(String(fetchMock.mock.calls[0]![0])).toBe("/api/profile/username?value=mika_1");
    const input = field(copy.fields.username);
    expect(input).toHaveAttribute("aria-invalid", "true");
    const message = document.getElementById(input.getAttribute("aria-describedby")!);
    expect(message).toHaveTextContent(copy.errors.taken);
  });

  it("does not ask the server while the local validator already fails", async () => {
    vi.useFakeTimers();
    render(<EditProfile view={makeView()} />);
    fireEvent.change(field(copy.fields.username), { target: { value: "ab" } });
    fireEvent.blur(field(copy.fields.username));
    await act(async () => { await vi.advanceTimersByTimeAsync(900); });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(field(copy.fields.username)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(copy.errors.format)).toBeInTheDocument();
  });

  it("saves multipart: a JSON profile part without locale, and the chosen photo", async () => {
    const user = userEvent.setup();
    render(<EditProfile view={makeView()} />);
    await user.upload(screen.getByLabelText(copy.avatar.label), photo());
    await type(copy.fields.displayName, "Mika");
    await user.click(screen.getByRole("button", { name: copy.save }));
    expect(profileCalls()).toHaveLength(1);
    const [, init] = profileCalls()[0]!;
    expect(init.method).toBe("PATCH");
    const form = init.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    const sent = JSON.parse(String(form.get("profile")));
    expect(sent.avatar).toBe("replace");
    expect(sent.fields.displayName).toBe("Mika");
    expect(sent.preferences).toEqual({ dailyMinutes: 20, readingTranslation: "reveal", readingFurigana: "always", companionEnabled: true });
    expect(JSON.stringify(sent)).not.toContain("locale");
    expect((form.get("avatar") as File).name).toBe("me.png");
  });

  it("maps a 409 onto the Username field and focuses it", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url === "/api/profile" ? json(409, { error: "Username taken", fields: { username: "taken" } }) : json(200, { data: { available: true } }));
    const user = userEvent.setup();
    render(<EditProfile view={makeView()} />);
    await type(copy.fields.bio, "x");
    await user.click(screen.getByRole("button", { name: copy.save }));
    const input = field(copy.fields.username);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(document.getElementById(input.getAttribute("aria-describedby")!)).toHaveTextContent(copy.errors.taken);
    expect(input).toHaveFocus();
    expect(push).not.toHaveBeenCalled();
  });

  it("maps 400 fields onto their controls and focuses the first one on the page", async () => {
    fetchMock.mockImplementation(async () =>
      json(400, { error: "Invalid input", fields: { learningGoal: "too_long", bio: "too_long" } }));
    const user = userEvent.setup();
    render(<EditProfile view={makeView()} />);
    await type(copy.fields.displayName, "Mika");
    await user.click(screen.getByRole("button", { name: copy.save }));
    expect(field(copy.fields.bio)).toHaveFocus();
    expect(field(copy.fields.learningGoal)).toHaveAttribute("aria-invalid", "true");
  });

  it("validates locally before posting", async () => {
    const user = userEvent.setup();
    render(<EditProfile view={makeView()} />);
    await type(copy.fields.displayName, "");
    await user.click(screen.getByRole("button", { name: copy.save }));
    expect(profileCalls()).toHaveLength(0);
    expect(field(copy.fields.displayName)).toHaveFocus();
    expect(screen.getByText(copy.errors.required)).toBeInTheDocument();
  });

  it("shows a chosen photo as a local object URL, revoking the previous one and revoking on unmount", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<EditProfile view={makeView()} />);
    await user.upload(screen.getByLabelText(copy.avatar.label), photo());
    expect(within(screen.getByRole("region", { name: "Keishaa" })).getByRole("img")).toHaveAttribute("src", "blob:local-1");
    await user.upload(screen.getByLabelText(copy.avatar.label), photo());
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:local-1");
    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:local-2");
  });

  it("rejects a wrong type before any upload", async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<EditProfile view={makeView()} />);
    await user.upload(screen.getByLabelText(copy.avatar.label), new File(["x"], "a.gif", { type: "image/gif" }));
    expect(screen.getByText(copy.avatar.errors.type)).toBeInTheDocument();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("offers Remove uploaded photo only with an uploaded photo, and sends remove", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<EditProfile view={makeView()} />);
    expect(screen.queryByRole("button", { name: copy.avatar.remove })).toBeNull();
    unmount();
    const view = makeView();
    render(<EditProfile view={{ ...view, identity: { ...view.identity, hasUploadedAvatar: true, avatarUrl: "https://x/y.webp" } }} />);
    await user.click(screen.getByRole("button", { name: copy.avatar.remove }));
    expect(within(screen.getByRole("region", { name: "Keishaa" })).queryByRole("img")).toBeNull();
    await user.click(screen.getByRole("button", { name: copy.save }));
    expect(JSON.parse(String((profileCalls()[0]![1].body as FormData).get("profile"))).avatar).toBe("remove");
  });

  it("hides the Korume preview cards and the footer line when Show Korume is off", async () => {
    const user = userEvent.setup();
    render(<EditProfile view={makeView()} />);
    expect(screen.getByText(copy.currentKorume.eyebrow)).toBeInTheDocument();
    expect(screen.getByText(copy.korumeFooter)).toBeInTheDocument();
    await user.click(screen.getByRole("switch", { name: copy.fields.showKorume }));
    expect(screen.queryByText(copy.currentKorume.eyebrow)).toBeNull();
    expect(screen.queryByText(copy.relationship.eyebrow)).toBeNull();
    expect(screen.queryByText(copy.korumeFooter)).toBeNull();
  });

  it("on success merges the four preferences, detaches the guard BEFORE navigating, and refreshes /profile", async () => {
    // At the instant router.push runs, a link click must already pass through the guard untouched.
    const link = document.body.appendChild(Object.assign(document.createElement("a"), { href: "#later" }));
    let guardedAtPush: boolean | null = null;
    push.mockImplementation(() => {
      let prevented = false;
      const seen = (e: Event) => { prevented = e.defaultPrevented; e.preventDefault(); };
      link.addEventListener("click", seen);
      link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
      link.removeEventListener("click", seen);
      guardedAtPush = prevented;
    });
    const user = userEvent.setup();
    render(<EditProfile view={makeView()} />);
    await type(copy.fields.displayName, "Mika");
    await user.click(screen.getByRole("button", { name: copy.save }));
    expect(setLocal).toHaveBeenCalledWith({ dailyMinutes: 20, readingTranslation: "reveal", readingFurigana: "always", companionEnabled: true });
    expect(push).toHaveBeenCalledWith("/profile");
    expect(guardedAtPush).toBe(false);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    link.remove();
  });

  it("keeps Save busy after success so a second PATCH cannot fire during navigation", async () => {
    const user = userEvent.setup();
    render(<EditProfile view={makeView()} />);
    await type(copy.fields.bio, "x");
    await user.click(screen.getByRole("button", { name: copy.save }));
    const busy = screen.getByRole("button", { name: copy.saving });
    expect(busy).toBeDisabled();
    await user.click(busy);
    expect(profileCalls()).toHaveLength(1);
  });

  it("tells a signed-out learner to sign in again (401)", async () => {
    fetchMock.mockImplementation(async () => json(401, { error: "Unauthorized" }));
    const user = userEvent.setup();
    render(<EditProfile view={makeView()} />);
    await type(copy.fields.bio, "x");
    await user.click(screen.getByRole("button", { name: copy.save }));
    expect(screen.getByRole("alert")).toHaveTextContent(copy.signedOut);
    expect(push).not.toHaveBeenCalled();
  });

  it("shows a local username format error on blur, not on the first keystroke", async () => {
    render(<EditProfile view={makeView()} />);
    const input = field(copy.fields.username);
    fireEvent.change(input, { target: { value: "ab" } });
    expect(input).not.toHaveAttribute("aria-invalid");
    fireEvent.blur(input);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(copy.errors.format)).toBeInTheDocument();
  });

  it("lets a picked photo be undone when there is no uploaded photo to remove", async () => {
    const user = userEvent.setup();
    render(<EditProfile view={makeView()} />);
    expect(screen.queryByRole("button", { name: copy.avatar.undo })).toBeNull();
    await user.upload(screen.getByLabelText(copy.avatar.label), photo());
    await user.click(screen.getByRole("button", { name: copy.avatar.undo }));
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:local-1");
    expect(within(screen.getByRole("region", { name: "Keishaa" })).queryByRole("img")).toBeNull();
    expect(screen.queryByRole("button", { name: copy.avatar.undo })).toBeNull();
    await user.type(field(copy.fields.bio), "x");
    await user.click(screen.getByRole("button", { name: copy.save }));
    expect(JSON.parse(String((profileCalls()[0]![1].body as FormData).get("profile"))).avatar).toBe("keep");
  });

  it("Back then Leave goes back past the one sentinel, exactly once, even after dirty-clean-dirty", async () => {
    window.history.pushState(null, "");
    window.history.pushState(null, "");
    const pushState = vi.spyOn(window.history, "pushState");
    const go = vi.spyOn(window.history, "go").mockImplementation(() => undefined);
    const user = userEvent.setup();
    render(<EditProfile view={makeView()} />);
    const bio = field(copy.fields.bio);
    await user.type(bio, "x");
    await user.type(bio, "{Backspace}");
    await user.type(bio, "y");
    expect(pushState).toHaveBeenCalledTimes(1);
    window.history.replaceState(null, ""); // Back lands on the page entry
    act(() => { fireEvent(window, new PopStateEvent("popstate")); });
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: copy.dirty.leave }));
    expect(go).toHaveBeenCalledTimes(1);
    expect(go).toHaveBeenCalledWith(-2);
  });

  it("Back then Leave in a fresh tab (nothing below the page) goes to /profile instead", async () => {
    Object.defineProperty(window.history, "length", { value: 1, configurable: true });
    const go = vi.spyOn(window.history, "go").mockImplementation(() => undefined);
    const user = userEvent.setup();
    render(<EditProfile view={makeView()} />);
    await user.type(field(copy.fields.bio), "y");
    window.history.replaceState(null, "");
    act(() => { fireEvent(window, new PopStateEvent("popstate")); });
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: copy.dirty.leave }));
    expect(go).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/profile");
  });

  it("goes to /profile in the new locale when the interface language changed", async () => {
    const user = userEvent.setup();
    render(<EditProfile view={makeView()} />);
    await user.click(screen.getByRole("combobox", { name: copy.fields.interfaceLanguage }));
    await user.click(await screen.findByRole("option", { name: "Tiếng Việt" }));
    await user.click(screen.getByRole("button", { name: copy.save }));
    expect(replace).toHaveBeenCalledWith("/profile", { locale: "vi" });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
  });

  it("does not render the controls the owner removed (R3, R5)", () => {
    render(<EditProfile view={makeView()} />);
    for (const name of [/profile visibility/i, /journal visibility/i, /show achievements/i, /learning reminders/i, /weekly report/i, /study time/i]) {
      expect(screen.queryByText(name)).toBeNull();
      expect(screen.queryByLabelText(name)).toBeNull();
    }
  });

  it("offers timezones through a datalist, keeps an unlisted stored value, and flags an invalid one on blur", async () => {
    const user = userEvent.setup();
    const view = makeView();
    render(<EditProfile view={{ ...view, identity: { ...view.identity, timeZone: "Asia/Saigon" } }} />);
    const input = field(copy.fields.timeZone);
    expect(input.value).toBe("Asia/Saigon");
    const list = document.getElementById(input.getAttribute("list")!)!;
    expect(list.tagName).toBe("DATALIST");
    expect(list.querySelectorAll("option").length).toBeGreaterThan(50);
    await user.clear(input);
    await user.type(input, "Nope/Zone");
    await user.tab();
    expect(screen.getByText(copy.errors.time_zone)).toBeInTheDocument();
  });

  it("offers only the known codes for the closed lists", async () => {
    const user = userEvent.setup();
    render(<EditProfile view={makeView()} />);
    expect(screen.getAllByRole("button", { pressed: false }).length + screen.getAllByRole("button", { pressed: true }).length).toBe(8);
    await user.click(screen.getByRole("combobox", { name: copy.fields.targetJlpt }));
    const names = (await screen.findAllByRole("option")).map((o) => (o.textContent ?? "").replace("✓", ""));
    expect(names).toEqual([copy.notSet, "N5", "N4", "N3", "N2", "N1"]);
  });

  it("toggles preferred practices with aria-pressed and sends the closed codes in catalog order", async () => {
    const user = userEvent.setup();
    render(<EditProfile view={makeView()} />);
    const grammar = screen.getByRole("button", { name: copy.practice.grammar });
    expect(grammar).toHaveAttribute("aria-pressed", "false");
    await user.click(grammar);
    expect(grammar).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: copy.save }));
    const sent = JSON.parse(String((profileCalls()[0]![1].body as FormData).get("profile")));
    expect(sent.fields.preferredPractices).toEqual(["shadowing", "grammar"]);
  });

  it("guards unsaved changes: a link click opens a Stay/Leave dialog, Leave goes there", async () => {
    const user = userEvent.setup();
    render(<EditProfile view={makeView()} />);
    const link = document.body.appendChild(Object.assign(document.createElement("a"), { href: "/en/settings", textContent: "away" }));
    // untouched: nothing intercepted
    const clean = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    link.addEventListener("click", (e) => e.preventDefault());
    link.dispatchEvent(clean);
    expect(screen.queryByRole("dialog")).toBeNull();
    await type(copy.fields.bio, "changed");
    await user.click(link);
    const dialog = await screen.findByRole("dialog", { name: copy.dirty.title });
    await user.click(within(dialog).getByRole("button", { name: copy.dirty.stay }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(push).not.toHaveBeenCalled();
    await user.click(link);
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: copy.dirty.leave }));
    expect(push).toHaveBeenCalledWith("/settings", { locale: "en" });
    link.remove();
  });

  it("announces the saving state on the button", async () => {
    let finish: (value: unknown) => void = () => undefined;
    fetchMock.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const user = userEvent.setup();
    render(<EditProfile view={makeView()} />);
    await type(copy.fields.bio, "x");
    await user.click(screen.getByRole("button", { name: copy.save }));
    const busy = screen.getByRole("button", { name: copy.saving });
    expect(busy).toHaveAttribute("aria-busy", "true");
    expect(busy).toBeDisabled();
    await act(async () => { finish(json(200, { data: { avatarUrl: null } })); });
  });

  it("shows the mascot beside the footer line, following the unsaved Show Korume switch", async () => {
    const user = userEvent.setup();
    const { container } = render(<EditProfile view={makeView()} />);
    expect(container.querySelector('[data-mascot-pose="edit-footer"]')).not.toBeNull();
    await user.click(screen.getByRole("switch", { name: copy.fields.showKorume }));
    expect(container.querySelector('[data-mascot-pose="edit-footer"]')).toBeNull();
    expect(profileCalls()).toHaveLength(0);
  });

  it("opens the same file input from the preview camera badge, and the chosen photo previews", async () => {
    const user = userEvent.setup();
    render(<EditProfile view={makeView()} />);
    const input = screen.getByLabelText(copy.avatar.label) as HTMLInputElement;
    const click = vi.spyOn(input, "click");
    const preview = screen.getByRole("region", { name: "Keishaa" });
    await user.click(within(preview).getByRole("button", { name: copy.avatar.change }));
    expect(click).toHaveBeenCalledTimes(1);
    await user.upload(input, photo());
    expect(within(preview).getByRole("img")).toHaveAttribute("src", "blob:local-1");
  });

  it("previews the unsaved Interface Language in the Current interface row", async () => {
    const user = userEvent.setup();
    render(<EditProfile view={makeView()} />);
    const preview = screen.getByRole("region", { name: "Keishaa" });
    expect(within(preview).getByText("English")).toBeInTheDocument();
    await user.click(screen.getByRole("combobox", { name: copy.fields.interfaceLanguage }));
    await user.click(await screen.findByRole("option", { name: "Tiếng Việt" }));
    expect(within(screen.getByRole("region", { name: "Keishaa" })).queryByText("English")).toBeNull();
  });
});
