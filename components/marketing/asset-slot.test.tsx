import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { AssetSlot } from "./asset-slot";

describe("AssetSlot", () => {
  it("renders a labelled pending state when no src is given", () => {
    render(<AssetSlot ratio="16/9" description="A quiet Kyoto street at dusk." />);

    const pending = screen.getByRole("img", { name: /A quiet Kyoto street at dusk\./ });
    expect(pending).toHaveAttribute("data-asset-pending", "true");
  });

  it("says, in the accessible name, that the image is not yet available", () => {
    render(<AssetSlot ratio="16/9" description="A quiet Kyoto street at dusk." />);

    expect(
      screen.getByRole("img", { name: /image pending/i }),
    ).toBeInTheDocument();
  });

  it("renders a real image once a src is given, and drops the pending marker", () => {
    render(
      <AssetSlot ratio="16/9" description="A quiet Kyoto street at dusk." src="/marketing/hero.jpg" />,
    );

    const image = screen.getByRole("img", { name: "A quiet Kyoto street at dusk." });
    expect(image).not.toHaveAttribute("data-asset-pending");
  });

  it("tells the browser how wide a filled slot actually is, so it cannot fetch the 3840px variant", () => {
    // Without `sizes`, `fill` means 100vw and the browser picks the largest
    // srcset entry: measured 1336 KB / 4.9s for §2's photograph against 190 KB
    // for the same file at a sane width, with the section rendering an empty
    // right third meanwhile. The subject is the srcset the browser is offered,
    // so `sizes` is asserted directly — there is no layout in jsdom to infer it
    // from, and `w=3840` in the URL is a consequence, not the cause.
    render(
      <AssetSlot ratio="16/9" description="A quiet Kyoto street at dusk." src="/marketing/hero.jpg" />,
    );

    const image = screen.getByRole("img", { name: "A quiet Kyoto street at dusk." });
    const sizes = image.getAttribute("sizes");
    expect(sizes).toBeTruthy();
    expect(sizes).toContain("vw");
    expect(sizes).not.toBe("100vw");

    const srcset = image.getAttribute("srcset") ?? "";
    const widths = Array.from(srcset.matchAll(/\s(\d+)w/g)).map((m) => Number(m[1]));
    expect(widths.length).toBeGreaterThan(0);
    expect(Math.min(...widths)).toBeLessThan(1920);
  });

  it("applies the requested aspect ratio as a relationship, not a pixel size", () => {
    const { container } = render(<AssetSlot ratio="4/3" description="d" />);

    const slot = container.querySelector("[data-asset-slot]");
    expect(slot).toHaveClass("aspect-[4/3]");
  });
});
