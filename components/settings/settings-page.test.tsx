import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { PreferencesProvider } from "@/components/providers/preferences-provider";
import { ToastProvider } from "@/components/ui/toast";
import { DEFAULT_PREFERENCES } from "@/lib/preferences/options";
import enSettings from "@/messages/en/settings.json";
import { SettingsPage } from "./settings-page";

vi.mock("@/lib/i18n/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/i18n/navigation")>()),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/settings",
}));

const copy = enSettings.page;

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute("style");
});

function mount() {
  return render(
    <ThemeProvider>
      <ToastProvider>
        <PreferencesProvider initial={DEFAULT_PREFERENCES}>
          <SettingsPage initialAiTrainingConsent={false} pending={null} version="1.2.3" />
        </PreferencesProvider>
      </ToastProvider>
    </ThemeProvider>,
  );
}

describe("SettingsPage", () => {
  it("renders the header the frame draws, with the mascot as decoration", () => {
    const { container } = mount();

    expect(screen.getByRole("heading", { level: 1, name: copy.title })).toBeInTheDocument();
    expect(screen.getByText(copy.eyebrow)).toBeInTheDocument();
    expect(screen.getByText(copy.subtitle)).toBeInTheDocument();

    // Decorative: the header's words carry the meaning, so the mascot must
    // not be announced. It is also the small size, not the auth screens' anchor.
    const mascot = container.querySelector("[data-mascot-pose='settings']");
    expect(mascot).toHaveAttribute("aria-hidden", "true");
    expect(mascot).toHaveAttribute("data-size", "sm");
  });

  // Gathered by a list, so its size is asserted (CLAUDE.md §7).
  it("shows the four bands the frame keeps, each a named landmark", () => {
    mount();
    const bands = [copy.learning.title, copy.appearance.title, copy.privacy.title, copy.about.title];

    expect(bands).toHaveLength(4);
    for (const name of bands) {
      expect(screen.getByRole("region", { name })).toBeInTheDocument();
    }
  });

  it("shows the same Danger Zone the privacy page shows", () => {
    mount();
    expect(screen.getByText(enSettings.dangerZone.title)).toBeInTheDocument();
    expect(screen.getByText(enSettings.dangerZone.memory.title)).toBeInTheDocument();
    expect(screen.getByText(enSettings.dangerZone.closeAccount.title)).toBeInTheDocument();
    expect(screen.getByText(enSettings.dangerZone.eraseAll.title)).toBeInTheDocument();
  });

  it("reports the running version in About and in the footer", () => {
    mount();
    expect(screen.getByRole("region", { name: copy.about.title })).toHaveTextContent("1.2.3");
    expect(screen.getByText(copy.footer.line.replace("{version}", "1.2.3"))).toBeInTheDocument();
    expect(screen.getByText(copy.footer.tagline)).toBeInTheDocument();
  });

  it("offers the support card's one real destination", () => {
    mount();
    const link = screen.getByRole("link", { name: copy.support.action });
    expect(link).toHaveAttribute("href", "/en/sensei");
  });

  /**
   * ⚠️ The point of this test is what is NOT here. Spec §1.3, §1.7 and §10
   * drop these rows because nothing in this repo is behind them; a row that
   * goes nowhere looks finished, which is worse than an absent row. Gathered
   * by a list whose size is asserted, or an empty list would pass silently.
   */
  it("ships no row that leads nowhere", () => {
    mount();
    const absent = [
      "Theme",
      "Accent Color",
      "Study Reminder Time",
      "Learning Reminders",
      "Discord",
      "Facebook",
      "TikTok",
      "Privacy Policy",
      "Terms of Service",
      "Send Feedback",
      "Contact Support",
    ];

    expect(absent).toHaveLength(11);
    for (const label of absent) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
  });
});
