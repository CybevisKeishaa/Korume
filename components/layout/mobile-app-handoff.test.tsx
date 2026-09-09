import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/app-stores";
import { MobileAppHandoff } from "@/components/layout/mobile-app-handoff";

describe("MobileAppHandoff", () => {
  it("gives mobile visitors labelled store links that open safely in a new tab", () => {
    // This catches a handoff that renders a generic container instead of the
    // navigable main destination, or lets either store URL drift from its
    // canonical value in lib/app-stores.ts.
    render(
      <MobileAppHandoff
        eyebrow="Korume mobile app"
        title="Study anywhere"
        body="Continue your Japanese study in the Korume app."
        appStoreLabel="Download on the App Store"
        playStoreLabel="Get it on Google Play"
      />,
    );

    expect(screen.getByRole("main", { name: "Study anywhere" })).toBeInTheDocument();

    const appStoreLink = screen.getByRole("link", { name: "Download on the App Store" });
    expect(appStoreLink).toHaveAttribute("href", APP_STORE_URL);
    expect(appStoreLink).toHaveAttribute("target", "_blank");
    expect(appStoreLink).toHaveAttribute("rel", "noreferrer");

    const playStoreLink = screen.getByRole("link", { name: "Get it on Google Play" });
    expect(playStoreLink).toHaveAttribute("href", PLAY_STORE_URL);
    expect(playStoreLink).toHaveAttribute("target", "_blank");
    expect(playStoreLink).toHaveAttribute("rel", "noreferrer");
  });
});
