import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { Badge } from "./badge";

describe("Badge", () => {
  it("renders its content", () => {
    render(<Badge>N5</Badge>);
    expect(screen.getByText("N5")).toBeInTheDocument();
  });

  it("applies the variant style", () => {
    render(<Badge variant="success">passed</Badge>);
    // The `-strong` tone specifically: `text-success` alone would not meet
    // WCAG AA on the 10% tint (lib/design-tokens.contrast.test.ts), and a
    // substring match on "text-success" would pass for either.
    const className = screen.getByText("passed").className;
    expect(className).toContain("text-success-strong");
    expect(className).toContain("text-caption");
  });

  it("defaults to the neutral variant and merges className", () => {
    render(<Badge className="uppercase">draft</Badge>);
    const badge = screen.getByText("draft");
    expect(badge.className).toContain("bg-muted");
    expect(badge.className).toContain("uppercase");
  });
});
