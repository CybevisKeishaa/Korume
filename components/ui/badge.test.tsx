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
    expect(screen.getByText("passed").className).toContain("text-success");
  });

  it("defaults to the neutral variant and merges className", () => {
    render(<Badge className="uppercase">draft</Badge>);
    const badge = screen.getByText("draft");
    expect(badge.className).toContain("bg-muted");
    expect(badge.className).toContain("uppercase");
  });
});
