import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@/test/render";
import { describe, expect, it, vi } from "vitest";
import AppRouteError from "@/app/[locale]/(protected)/(app)/error";
import { RouteErrorPanel } from "./route-error-panel";

vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ children, className, href }: { children: ReactNode; className?: string; href: string }) => (
    <a className={className} href={`/en${href}`}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/en/e2e-route-error" }));

describe("RouteErrorPanel", () => {
  it("retries and keeps its recovery actions available", () => {
    const onRetry = vi.fn();
    render(<RouteErrorPanel mode="in-shell" onRetry={onRetry} />);

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(onRetry).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: "Go to Dashboard" })).toHaveAttribute("href", "/en/dashboard");
    expect(screen.getByRole("button", { name: "Go Back" })).toBeInTheDocument();
    expect(screen.getByText("Your progress is still saved.")).toBeInTheDocument();
  });

  it("leaves density and app chrome to the live shell", () => {
    const { container } = render(<RouteErrorPanel mode="in-shell" onRetry={vi.fn()} />);

    expect(container.querySelector("[data-density]")).toBeNull();
    expect(container.querySelector("nav")).toBeNull();
    expect(container.querySelector("aside")).toBeNull();
  });

  it("does not expose boundary error details", () => {
    const error = Object.assign(new Error("SECRET_DB_DETAIL"), { digest: "abc123" });
    render(<AppRouteError error={error} reset={vi.fn()} />);

    expect(document.body.textContent).not.toContain("SECRET_DB_DETAIL");
    expect(document.body.textContent).not.toContain("abc123");
  });
});
