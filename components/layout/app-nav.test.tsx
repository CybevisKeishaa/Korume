import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AppNav, NAV_ITEMS } from "./app-nav";
// Plain JSON import (resolveJsonModule), not next-intl — this is the same
// source of truth @/test/render feeds into NextIntlClientProvider, so
// asserting against it is what makes this test catch a typo in ANY of the
// catalog's values, not just the ones someone remembered to hand-pick.
import navMessages from "@/messages/en/nav.json";

vi.mock("@/lib/i18n/navigation", async () => {
  const actual = await vi.importActual<typeof import("@/lib/i18n/navigation")>(
    "@/lib/i18n/navigation",
  );
  return { ...actual, usePathname: () => "/dashboard" };
});

vi.mock("@/components/layout/notification-bell", () => ({
  NotificationBell: () => null,
}));

// AppNav renders ThemeToggle + ReduceMotionToggle, both of which call
// useTheme() and throw outside a <ThemeProvider> (see
// components/ui/reduce-motion-toggle.test.tsx for the same pattern). @/test/render
// only supplies the i18n provider, so this test supplies ThemeProvider itself.
function renderNav(userEmail = "learner@example.com") {
  return render(
    <ThemeProvider>
      <AppNav userEmail={userEmail} />
    </ThemeProvider>,
  );
}

describe("AppNav", () => {
  it("renders every nav destination from the catalog, not a sample", () => {
    renderNav();
    for (const item of NAV_ITEMS) {
      const expectedLabel = navMessages[item.key as keyof typeof navMessages];
      expect(
        screen.getByRole("link", { name: expectedLabel }),
      ).toBeInTheDocument();
    }
  });

  it("names the nav landmark via the catalog's aria-label", () => {
    renderNav();
    expect(
      screen.getByRole("navigation", { name: navMessages.ariaLabel }),
    ).toBeInTheDocument();
  });

  it("marks the active destination", () => {
    renderNav();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("renders the sign-out control from the shared namespace", () => {
    renderNav();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });
});
