import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, within } from "@/test/render";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { PreferencesProvider } from "@/components/providers/preferences-provider";
import { ToastProvider } from "@/components/ui/toast";
import { DEFAULT_PREFERENCES, type UserPreferences } from "@/lib/preferences/options";
import en from "@/messages/en/settings.json";
import { LOCALE_ENDONYMS } from "@/lib/i18n/routing";
import { LearningSection } from "./learning-section";
import { AppearanceSection } from "./appearance-section";
import { PrivacyDataSection } from "./privacy-data-section";

/**
 * Every label below is read from the CATALOG, never typed as a literal.
 *
 * These assertions are about wiring — that a control carries the accessible
 * name of its own visible label, that the right row saved, that the hint
 * appeared. None of them is about the words. Hardcoding the English would
 * make this suite a second, invisible owner of the copy: rewording
 * `settings.json` would break a dozen tests with "Unable to find an
 * accessible element", which says nothing about what actually changed.
 *
 * Read `messages/README.md` before pinning a literal anywhere. The catalog is
 * the owner's to edit; a test that stops them editing it needs a reason.
 */
const copy = en.page;

const replace = vi.fn();
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/settings",
}));

let fetchMock: ReturnType<typeof vi.fn>;

function stubMatchMedia(osReduces = false) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: osReduces,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

/**
 * ⚠️ The mock ECHOES the patch back, the way the real route does.
 *
 * A mock that always answered `DEFAULT_PREFERENCES` looked fine and was
 * actively misleading: the hook applies the server's answer over its optimistic
 * one, so every save silently reverted to the default and only assertions on
 * the REQUEST could ever pass. "Choosing Custom reveals the day picker" failed
 * against correct code for exactly that reason.
 */
beforeEach(() => {
  replace.mockClear();
  fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    const patch = JSON.parse(String(init.body)) as Partial<UserPreferences>;
    return new Response(JSON.stringify({ data: { ...DEFAULT_PREFERENCES, ...patch } }), {
      status: 200,
    }) as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute("style");
});

function mount(ui: React.ReactNode, initial: Partial<UserPreferences> = {}) {
  return render(
    <ThemeProvider>
      <ToastProvider>
        <PreferencesProvider initial={{ ...DEFAULT_PREFERENCES, ...initial }}>{ui}</PreferencesProvider>
      </ToastProvider>
    </ThemeProvider>,
  );
}

/** The body of the single PATCH this interaction sent. */
function sentBody(): unknown {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  return JSON.parse(String(init.body));
}

describe("LearningSection", () => {
  beforeEach(() => stubMatchMedia());

  // Gathered by a list, so its size is asserted (CLAUDE.md §7): a `for` over an
  // empty array asserts nothing and reports green.
  it("gives every control the accessible name of its visible label", () => {
    mount(<LearningSection />);
    const rows: [role: string, name: string][] = [
      ["combobox", copy.language.label],
      ["combobox", copy.dailyGoal.label],
      ["radiogroup", copy.schedule.label],
      ["radiogroup", copy.reviewFrequency.label],
      ["radiogroup", copy.difficulty.label],
    ];

    expect(rows).toHaveLength(5);
    for (const [role, name] of rows) {
      expect(screen.getByRole(role, { name })).toBeInTheDocument();
    }
  });

  /**
   * The locale lives in the URL, so this row navigates and must NOT PATCH.
   * A save here would write a preference the address bar already owns, and the
   * two would drift the moment a user edited the URL.
   */
  it("navigates on a language change and saves nothing", async () => {
    const user = userEvent.setup();
    mount(<LearningSection />);

    // The harness renders at `en`, so Vietnamese is the row's OTHER option —
    // picking the already-selected one fires no change at all, in Radix or in
    // a real browser.
    await user.click(screen.getByRole("combobox", { name: copy.language.label }));
    await user.click(await screen.findByRole("option", { name: LOCALE_ENDONYMS.vi }));

    expect(replace).toHaveBeenCalledWith("/settings", { locale: "vi" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Endonyms, not translations: someone who cannot read the current interface
  // must still be able to find their own language in the list.
  it("lists each language in its own language", async () => {
    const user = userEvent.setup();
    mount(<LearningSection />);

    await user.click(screen.getByRole("combobox", { name: copy.language.label }));

    expect(await screen.findByRole("option", { name: LOCALE_ENDONYMS.vi })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: LOCALE_ENDONYMS.en })).toBeInTheDocument();
    // The one deliberate literal in this file: "Vietnamese" is the WRONG label,
    // and naming it is the whole assertion. Reading it from the catalog would
    // be circular.
    expect(screen.queryByRole("option", { name: "Vietnamese" })).not.toBeInTheDocument();
  });

  it("saves exactly one control's fields when difficulty changes", async () => {
    const user = userEvent.setup();
    mount(<LearningSection />);

    await user.click(screen.getByRole("radio", { name: copy.difficulty.challenge }));

    expect(sentBody()).toEqual({ difficulty: "challenge" });
  });

  it("sends no scheduleDays for a mode the server canonicalises", async () => {
    const user = userEvent.setup();
    mount(<LearningSection />);

    await user.click(screen.getByRole("radio", { name: copy.schedule.weekdays }));

    expect(sentBody()).toEqual({ learningSchedule: "weekdays" });
  });

  it("reveals the day picker only for Custom", async () => {
    const user = userEvent.setup();
    mount(<LearningSection />);
    expect(screen.queryByRole("group", { name: copy.schedule.daysLabel })).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: copy.schedule.custom }));

    const group = screen.getByRole("group", { name: copy.schedule.daysLabel });
    expect(within(group).getAllByRole("button")).toHaveLength(7);
  });

  it("toggles a day off and sends the remaining days", async () => {
    const user = userEvent.setup();
    mount(<LearningSection />, { learningSchedule: "custom", scheduleDays: [1, 2, 3] });

    await user.click(screen.getByRole("button", { name: copy.schedule.day["2"], pressed: true }));

    expect(sentBody()).toEqual({ learningSchedule: "custom", scheduleDays: [1, 3] });
  });

  /**
   * The schema's `.min(1)` would 400 this, and a generic "could not save"
   * toast tells the user nothing about why. Refused before the request, so the
   * inline hint IS the outcome — assert BOTH the hint and that nothing was sent.
   */
  it("refuses to clear the last day, and sends nothing", async () => {
    const user = userEvent.setup();
    mount(<LearningSection />, { learningSchedule: "custom", scheduleDays: [3] });

    await user.click(screen.getByRole("button", { name: copy.schedule.day["3"], pressed: true }));

    expect(screen.getByRole("alert")).toHaveTextContent(copy.schedule.atLeastOne);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: copy.schedule.day["3"] })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("AppearanceSection", () => {
  it("saves the chosen display scale and nothing else", async () => {
    stubMatchMedia();
    const user = userEvent.setup();
    mount(<AppearanceSection />);

    await user.click(screen.getByRole("radio", { name: copy.displayScale.large }));

    expect(sentBody()).toEqual({ displayScale: "large" });
  });

  it("saves the reduced-motion switch as a boolean", async () => {
    stubMatchMedia();
    const user = userEvent.setup();
    mount(<AppearanceSection />);

    await user.click(screen.getByRole("switch", { name: copy.reducedMotion.label }));

    expect(sentBody()).toEqual({ reduceMotion: true });
  });

  /**
   * Spec §4.5: Korume may add reduction, never remove the OS's. With the OS
   * asking for it and the account switch off, the switch genuinely changes
   * nothing — so the note says so rather than leaving a dead control.
   */
  it("explains that the OS already reduces motion, and describes the switch with it", () => {
    stubMatchMedia(true);
    mount(<AppearanceSection />);

    const note = screen.getByText(copy.reducedMotion.osOverrides);
    expect(screen.getByRole("switch", { name: copy.reducedMotion.label })).toHaveAttribute(
      "aria-describedby",
      note.getAttribute("id"),
    );
  });

  it("drops the note once the account switch is on, because it is no longer true", () => {
    stubMatchMedia(true);
    mount(<AppearanceSection />, { reduceMotion: true });
    expect(screen.queryByText(copy.reducedMotion.osOverrides)).not.toBeInTheDocument();
  });

  it("shows no note when the OS does not ask", () => {
    stubMatchMedia(false);
    mount(<AppearanceSection />);
    expect(screen.queryByText(copy.reducedMotion.osOverrides)).not.toBeInTheDocument();
  });

  /**
   * ⚠️ This asserts that the options stay ENABLED mid-save, not that focus
   * survives — because **jsdom cannot see the focus bug at all**. Probed
   * directly: give jsdom a focused `<button>`, set `disabled = true`, and
   * `document.activeElement` is still that button. A real browser moves it to
   * `<body>`. A focus assertion here passes against the defect and proves
   * nothing; the first version of this test did exactly that, and only the
   * mutation check caught it.
   *
   * So the real proof lives in a browser — `tests/e2e/settings.spec.ts`,
   * "keyboard focus survives a display-scale change". This test guards the
   * structural cause that spec depends on, deterministically and in
   * milliseconds: `SegmentedControl.move()` focuses an option and only then
   * calls `onValueChange`, so as long as the save never disables the group,
   * there is nothing for the browser to blur.
   *
   * `usePreferenceSave` is what makes the `disabled` unnecessary: its rule 1
   * applies a response only if it belongs to the control's latest request, and
   * rule 3 rolls back to the last confirmed value.
   *
   * The fetch is held open by hand because the whole question is what the DOM
   * looks like WHILE the request is in flight.
   */
  it("leaves every option enabled while the save is still in flight", async () => {
    stubMatchMedia();
    let release!: (value: Response) => void;
    fetchMock.mockImplementationOnce(
      () => new Promise<Response>((resolve) => { release = resolve; }),
    );
    const user = userEvent.setup();
    mount(<AppearanceSection />);
    const group = screen.getByRole("radiogroup", { name: copy.displayScale.label });
    within(group).getByRole("radio", { name: copy.displayScale.normal }).focus();

    await user.keyboard("{ArrowRight}");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const options = within(group).getAllByRole("radio");
    expect(options).toHaveLength(3);
    for (const option of options) expect(option).toBeEnabled();

    release(new Response(JSON.stringify({ data: { ...DEFAULT_PREFERENCES, displayScale: "large" } }), { status: 200 }));
  });
});

describe("PrivacyDataSection", () => {
  beforeEach(() => stubMatchMedia());

  it("is the #privacy anchor the Danger Zone returns to", () => {
    mount(<PrivacyDataSection initialAiTrainingConsent={false} />);
    expect(screen.getByRole("region", { name: copy.privacy.title })).toHaveAttribute("id", "privacy");
  });

  it("saves the microphone switch on its own", async () => {
    const user = userEvent.setup();
    mount(<PrivacyDataSection initialAiTrainingConsent={false} />);

    await user.click(screen.getByRole("switch", { name: copy.microphone.label }));

    expect(sentBody()).toEqual({ microphoneEnabled: false });
  });

  it("sends AI Training to its own endpoint, not the preferences one", async () => {
    const user = userEvent.setup();
    mount(<PrivacyDataSection initialAiTrainingConsent={false} />);

    await user.click(screen.getByRole("switch", { name: /Help improve Korume/ }));

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/user/model-training-consent");
    expect(JSON.parse(String(init.body))).toEqual({ consent: true });
  });

  /**
   * `consent` is a `users` column, so it lives in this row's own state rather
   * than in `PreferencesProvider` — the hook cannot roll it back, and `save`
   * resolves rather than rejects, so a `.catch()` would never fire. Without
   * the explicit restore the switch stays on a value the server refused.
   */
  it("puts the AI Training switch back when the save fails", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "x" }), { status: 500 }) as Response,
    );
    mount(<PrivacyDataSection initialAiTrainingConsent={false} />);
    const toggle = screen.getByRole("switch", { name: /Help improve Korume/ });

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  /**
   * ⚠️ The other half of the rollback, and the one that only became reachable
   * when this control stopped rendering `disabled` while saving: two of its
   * PATCHes can now be in flight at once.
   *
   * A SUPERSEDED save must not roll back. Its value is already stale, so
   * restoring what it saw would undo the newer save that replaced it, leaving
   * the switch disagreeing with the database until a reload. `save` used to
   * answer a single `false` for "failed" and "superseded" alike, which made
   * the distinction impossible — even though this hook's own test is named
   * for keeping it.
   *
   * The first response is held open so the second click genuinely supersedes
   * it; then the first is failed, which is the case that would wrongly roll
   * back.
   */
  it("does not roll the AI Training switch back when a save is merely superseded", async () => {
    const user = userEvent.setup();
    let failFirst!: (value: Response) => void;
    fetchMock
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { failFirst = resolve; }))
      // ⚠️ A fresh `Response` PER CALL. `mockResolvedValue` hands every call
      // the SAME object, and a `Response` body can only be read once — the
      // second `.json()` throws, the hook takes its catch branch, and a
      // correct component fails. Cost half an hour of debugging here.
      .mockImplementation(async () => new Response(JSON.stringify({}), { status: 200 }) as Response);

    mount(<PrivacyDataSection initialAiTrainingConsent={false} />);
    const toggle = screen.getByRole("switch", { name: /Help improve Korume/ });

    await user.click(toggle); // -> true, held open
    await user.click(toggle); // -> false, resolves and supersedes the first
    await user.click(toggle); // -> true, the value that must survive

    failFirst(new Response(JSON.stringify({ error: "x" }), { status: 500 }) as Response);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });

  it("offers both downloads as real links the browser handles", () => {
    mount(<PrivacyDataSection initialAiTrainingConsent={false} />);

    expect(screen.getByRole("link", { name: copy.exportData.action })).toHaveAttribute(
      "href",
      "/api/user/export",
    );
    expect(screen.getByRole("link", { name: copy.history.action })).toHaveAttribute(
      "href",
      "/api/user/history.csv",
    );
  });
});
