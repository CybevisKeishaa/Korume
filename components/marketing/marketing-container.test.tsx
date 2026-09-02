import { describe, expect, it } from "vitest";
import { render } from "@/test/render";
import { MarketingContainer } from "./marketing-container";

/**
 * Task 12. The marketing pages are wider than the rest of the app, and this is
 * the one place that says so.
 *
 * Measured, not chosen: frame `347:6277` — the binding design for `/` per §11
 * ruling 1 — is **1280 CSS px wide**, the same width the reference quality bar
 * `346:6275` is a 0.675x render of. Scanning that render for the most common
 * bounded content edge puts the design's content 3.46% of the page width in
 * from each side, i.e. ~44px at 1280. `Container`'s stock `max-w-6xl` puts ours
 * 96px in.
 *
 * ⚠️ `Container` itself is NOT widened, and that is the point: it has 36
 * consumers and only the marketing surfaces are four of them. Widening it would
 * silently re-lay-out every dashboard, kanji, vocab, shadowing, admin and auth
 * screen — none of which frame `347:6277` says anything about.
 */
describe("MarketingContainer", () => {
  it("replaces Container's app-wide max width with the measured marketing one", () => {
    const { container } = render(
      <MarketingContainer>
        <p>content</p>
      </MarketingContainer>,
    );

    const box = container.firstElementChild;
    if (!box) throw new Error("MarketingContainer rendered nothing");
    const classes = box.className.split(/\s+/);

    expect(classes).toContain("max-w-marketing");
    // `cn()` must have RESOLVED the conflict, not kept both — twMerge only does
    // that for a name it recognizes, which is why `max-w-marketing` is
    // registered in lib/utils.ts. Both classes surviving would leave CSS source
    // order to decide the page's width.
    expect(classes).not.toContain("max-w-6xl");
  });

  it("keeps Container's gutters and centring, and forwards a caller's classes", () => {
    const { container } = render(
      <MarketingContainer className="grid gap-xl">
        <p>content</p>
      </MarketingContainer>,
    );

    const box = container.firstElementChild;
    if (!box) throw new Error("MarketingContainer rendered nothing");
    const classes = box.className.split(/\s+/);

    // Only the max width changes — the gutters are still Container's.
    expect(classes).toContain("mx-auto");
    expect(classes).toContain("px-4");
    expect(classes).toContain("grid");
    expect(classes).toContain("gap-xl");
  });
});
