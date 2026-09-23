import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, within } from "@/test/render";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { PreferencesProvider } from "@/components/providers/preferences-provider";
import { ToastProvider } from "@/components/ui/toast";
import { DEFAULT_PREFERENCES, type UserPreferences } from "@/lib/preferences/options";
import { LearningSection } from "./learning-section";
import { AppearanceSection } from "./appearance-section";
import { PrivacyDataSection } from "./privacy-data-section";

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

  it("gives every control the accessible name of its visible label", () => {
    mount(<LearningSection />);
    for (const name of [
      "Interface Language",
      "Daily Learning Goal",
      "Learning Schedule",
      "Review Frequency",
      "Difficulty Preference",
    ]) {
      expect(screen.getByRole(/Language|Goal/.test(name) ? "combobox" : "radiogroup", { name })).toBeInTheDocument();
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
    await user.click(screen.getByRole("combobox", { name: "Interface Language" }));
    await user.click(await screen.findByRole("option", { name: "Tiếng Việt" }));

    expect(replace).toHaveBeenCalledWith("/settings", { locale: "vi" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Endonyms, not translations: someone who cannot read the current interface
  // must still be able to find their own language in the list.
  it("lists each language in its own language", async () => {
    const user = userEvent.setup();
    mount(<LearningSection />);

    await user.click(screen.getByRole("combobox", { name: "Interface Language" }));

    expect(await screen.findByRole("option", { name: "Tiếng Việt" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "English" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Vietnamese" })).not.toBeInTheDocument();
  });

  it("saves exactly one control's fields when difficulty changes", async () => {
    const user = userEvent.setup();
    mount(<LearningSection />);

    await user.click(screen.getByRole("radio", { name: "Challenge" }));

    expect(sentBody()).toEqual({ difficulty: "challenge" });
  });

  it("sends no scheduleDays for a mode the server canonicalises", async () => {
    const user = userEvent.setup();
    mount(<LearningSection />);

    await user.click(screen.getByRole("radio", { name: "Weekdays" }));

    expect(sentBody()).toEqual({ learningSchedule: "weekdays" });
  });

  it("reveals the day picker only for Custom", async () => {
    const user = userEvent.setup();
    mount(<LearningSection />);
    expect(screen.queryByRole("group", { name: "Study days" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Custom" }));

    const group = screen.getByRole("group", { name: "Study days" });
    expect(within(group).getAllByRole("button")).toHaveLength(7);
  });

  it("toggles a day off and sends the remaining days", async () => {
    const user = userEvent.setup();
    mount(<LearningSection />, { learningSchedule: "custom", scheduleDays: [1, 2, 3] });

    await user.click(screen.getByRole("button", { name: "Tue", pressed: true }));

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

    await user.click(screen.getByRole("button", { name: "Wed", pressed: true }));

    expect(screen.getByRole("alert")).toHaveTextContent("Pick at least one day");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Wed" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("AppearanceSection", () => {
  it("saves the chosen display scale and nothing else", async () => {
    stubMatchMedia();
    const user = userEvent.setup();
    mount(<AppearanceSection />);

    await user.click(screen.getByRole("radio", { name: "Large" }));

    expect(sentBody()).toEqual({ displayScale: "large" });
  });

  it("saves the reduced-motion switch as a boolean", async () => {
    stubMatchMedia();
    const user = userEvent.setup();
    mount(<AppearanceSection />);

    await user.click(screen.getByRole("switch", { name: "Reduced Motion" }));

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

    const note = screen.getByText(/device already asks for reduced motion/);
    expect(screen.getByRole("switch", { name: "Reduced Motion" })).toHaveAttribute(
      "aria-describedby",
      note.getAttribute("id"),
    );
  });

  it("drops the note once the account switch is on, because it is no longer true", () => {
    stubMatchMedia(true);
    mount(<AppearanceSection />, { reduceMotion: true });
    expect(screen.queryByText(/device already asks for reduced motion/)).not.toBeInTheDocument();
  });

  it("shows no note when the OS does not ask", () => {
    stubMatchMedia(false);
    mount(<AppearanceSection />);
    expect(screen.queryByText(/device already asks for reduced motion/)).not.toBeInTheDocument();
  });
});

describe("PrivacyDataSection", () => {
  beforeEach(() => stubMatchMedia());

  it("is the #privacy anchor the Danger Zone returns to", () => {
    mount(<PrivacyDataSection initialAiTrainingConsent={false} />);
    expect(screen.getByRole("region", { name: "Privacy & Data" })).toHaveAttribute("id", "privacy");
  });

  it("saves the microphone switch on its own", async () => {
    const user = userEvent.setup();
    mount(<PrivacyDataSection initialAiTrainingConsent={false} />);

    await user.click(screen.getByRole("switch", { name: "Microphone" }));

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

  it("offers both downloads as real links the browser handles", () => {
    mount(<PrivacyDataSection initialAiTrainingConsent={false} />);

    expect(screen.getByRole("link", { name: "Download" })).toHaveAttribute(
      "href",
      "/api/user/export",
    );
    expect(screen.getByRole("link", { name: "Download CSV" })).toHaveAttribute(
      "href",
      "/api/user/history.csv",
    );
  });
});
