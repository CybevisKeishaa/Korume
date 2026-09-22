import { render, screen } from "@/test/render";
import { describe, expect, it, vi } from "vitest";
import { RequestedPath } from "./requested-path";

const { pathname } = vi.hoisted(() => ({ pathname: { current: "/en/kanji/lesson/green" } }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
}));

describe("RequestedPath", () => {
  it("renders the pathname in code", () => {
    render(<RequestedPath label="You were looking for" />);

    expect(screen.getByText("/en/kanji/lesson/green").tagName).toBe("CODE");
  });

  it("renders a script-shaped path as text", () => {
    pathname.current = "/en/<script>alert(1)</script>";
    const { container } = render(<RequestedPath label="You were looking for" />);

    expect(screen.getByText("/en/<script>alert(1)</script>").tagName).toBe("CODE");
    expect(container.querySelector("script")).toBeNull();
  });
});
