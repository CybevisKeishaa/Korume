import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import type { FormStatus } from "react-dom";
import type { ResetRequestState } from "@/app/[locale]/(auth)/actions";
import { ForgotPasswordForm } from "./forgot-password-form";

const { requestPasswordReset, resetState } = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
  resetState: { current: {} as ResetRequestState },
}));

vi.mock("@/app/[locale]/(auth)/actions", () => ({ requestPasswordReset }));

vi.mock("react-dom", async () => {
  const actual = await vi.importActual<typeof import("react-dom")>("react-dom");
  return {
    ...actual,
    useFormState: () => [resetState.current, "/", false] as const,
    useFormStatus: (): FormStatus => ({
      pending: false,
      data: null,
      method: null,
      action: null,
    }),
  };
});

beforeEach(() => {
  resetState.current = {};
});

describe("ForgotPasswordForm", () => {
  it("shows the email request form and a route-local way back to login", () => {
    render(<ForgotPasswordForm />);

    expect(screen.getByLabelText("Email")).toHaveAttribute("autocomplete", "email");
    expect(screen.getByRole("button", { name: "Send reset link" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to login" })).toHaveAttribute(
      "href",
      "/en/login",
    );
  });

  it("replaces the form with the neutral confirmation after a request", () => {
    resetState.current = { sent: true };
    render(<ForgotPasswordForm />);

    expect(
      screen.getByText("If an account exists for that email, we've sent a reset link."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send reset link" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to login" })).toBeInTheDocument();
  });

  it("marks an invalid email for assistive technology", () => {
    resetState.current = { fieldErrors: { email: ["Enter a valid email address."] } };
    render(<ForgotPasswordForm />);

    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
  });
});
