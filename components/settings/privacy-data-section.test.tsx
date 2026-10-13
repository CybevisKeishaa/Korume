import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@/test/render";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { PreferencesProvider } from "@/components/providers/preferences-provider";
import { ToastProvider } from "@/components/ui/toast";
import { DEFAULT_PREFERENCES } from "@/lib/preferences/options";
import type { NewsletterState } from "@/lib/validation/newsletter";
import en from "@/messages/en/settings.json";
import { PrivacyDataSection } from "./privacy-data-section";

const refresh = vi.fn();
vi.mock("@/lib/i18n/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/i18n/navigation")>()),
  useRouter: () => ({ refresh }),
}));

function renderSection(state: NewsletterState | null) {
  return render(
    <ThemeProvider>
      <ToastProvider>
        <PreferencesProvider initial={DEFAULT_PREFERENCES}>
          <PrivacyDataSection initialAiTrainingConsent={false} initialNewsletter={state} />
        </PreferencesProvider>
      </ToastProvider>
    </ThemeProvider>,
  );
}

describe("PrivacyDataSection newsletter row (spec N4)", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it("shows the full account email and the saved state, anchored #newsletter", () => {
    renderSection({ email: "learner@example.com", optedIn: true });
    expect(document.getElementById("newsletter")).not.toBeNull();
    expect(screen.getByText(/learner@example\.com/)).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: en.newsletter.title })).toBeChecked();
  });

  it("PATCHes { optIn } to /api/user/newsletter and refreshes on success", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ data: { optedIn: false } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    renderSection({ email: "learner@example.com", optedIn: true });
    fireEvent.click(screen.getByRole("switch", { name: en.newsletter.title }));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/user/newsletter",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ optIn: false }) }),
    );
  });

  it("rolls the switch back when the save fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    renderSection({ email: "learner@example.com", optedIn: true });
    const toggle = screen.getByRole("switch", { name: en.newsletter.title });
    fireEvent.click(toggle);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await waitFor(() => expect(toggle).toBeChecked());
    expect(refresh).not.toHaveBeenCalled();
  });

  it("renders no row without a signed-in state", () => {
    renderSection(null);
    expect(screen.queryByRole("switch", { name: en.newsletter.title })).toBeNull();
  });
});
