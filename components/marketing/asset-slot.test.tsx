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

  it("applies the requested aspect ratio as a relationship, not a pixel size", () => {
    const { container } = render(<AssetSlot ratio="4/3" description="d" />);

    const slot = container.querySelector("[data-asset-slot]");
    expect(slot).toHaveClass("aspect-[4/3]");
  });
});
