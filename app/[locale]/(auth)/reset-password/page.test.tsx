import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import ResetPasswordPage from "./page";

const { getUser } = vi.hoisted(() => ({ getUser: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ auth: { getUser } }),
}));

vi.mock("@/lib/i18n/server", () => ({
  getTranslations: async () => (key: string) =>
    ({
      "errors.resetExpired": "This reset link has expired. Request a new one.",
      "resetPassword.requestNewLink": "Request a new link",
    })[key] ?? key,
}));

vi.mock("@/components/auth/auth-split-shell", () => ({
  AuthSplitShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/components/auth/auth-card", () => ({
  AuthCard: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
}));
vi.mock("@/components/auth/auth-story", () => ({ AuthStory: () => null }));
vi.mock("@/components/auth/reset-password-form", () => ({
  ResetPasswordForm: () => <form aria-label="Update password" />,
}));

beforeEach(() => {
  getUser.mockResolvedValue({ data: { user: null } });
});

describe("ResetPasswordPage", () => {
  it("shows an expired reset state with a request-link route when signed out", async () => {
    render(await ResetPasswordPage({ params: { locale: "en" } }));

    expect(screen.getByText("This reset link has expired. Request a new one.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Request a new link" })).toHaveAttribute(
      "href",
      "/en/forgot-password",
    );
    expect(screen.queryByRole("form", { name: "Update password" })).not.toBeInTheDocument();
  });

  it("shows the password form for a signed-in recovery session", async () => {
    getUser.mockResolvedValueOnce({ data: { user: { id: "u" } } });
    render(await ResetPasswordPage({ params: { locale: "en" } }));

    expect(screen.getByRole("form", { name: "Update password" })).toBeInTheDocument();
    expect(screen.queryByText("This reset link has expired. Request a new one.")).not.toBeInTheDocument();
  });
});
