import type { ReactNode } from "react";
import { render, screen } from "@/test/render";
import { describe, expect, it, vi } from "vitest";
import { NotFoundView } from "./not-found-view";

vi.mock("./back-button", () => ({
  BackButton: ({ children, className }: { children: ReactNode; className?: string }) => (
    <button type="button" className={className}>{children}</button>
  ),
}));

describe("NotFoundView", () => {
  it("renders the standalone 404 surface", () => {
    const { container } = render(
      <NotFoundView
        backLabel="Back"
        body="The path may have moved, or it may never have existed."
        eyebrow="404 · Wrong turn"
        goBackLabel="Go Back"
        goHomeLabel="Go Home"
        heading="We couldn't find this place."
        requestedPathLabel="You were looking for"
        wordmark="Korume"
      />,
    );

    expect(container.firstElementChild).toHaveAttribute("data-density", "reference");
    expect(screen.getByRole("heading", { name: "We couldn't find this place." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go Home" })).toHaveAttribute("href", "/en");
    expect(screen.getByRole("button", { name: "Go Back" })).toBeInTheDocument();
    expect(container.querySelector("[data-mascot-pose='not-found']")).not.toBeNull();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });
});
