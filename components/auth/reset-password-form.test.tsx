import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import type { FormStatus } from "react-dom";
import type { AuthState } from "@/app/[locale]/(auth)/actions";
import { ResetPasswordForm } from "./reset-password-form";

const { updatePassword, authState } = vi.hoisted(() => ({
  updatePassword: vi.fn(),
  authState: { current: {} as AuthState },
}));

vi.mock("@/app/[locale]/(auth)/actions", () => ({ updatePassword }));

vi.mock("react-dom", async () => {
  const actual = await vi.importActual<typeof import("react-dom")>("react-dom");
  return {
    ...actual,
    useFormState: () => [authState.current, "/", false] as const,
    useFormStatus: (): FormStatus => ({
      pending: false,
      data: null,
      method: null,
      action: null,
    }),
  };
});

describe("ResetPasswordForm", () => {
  it("uses two new-password fields and submits the update", () => {
    render(<ResetPasswordForm />);

    expect(screen.getByLabelText("New password")).toHaveAttribute("autocomplete", "new-password");
    expect(screen.getByLabelText("Confirm new password")).toHaveAttribute(
      "autocomplete",
      "new-password",
    );
    expect(screen.getByRole("button", { name: "Update password" })).toBeInTheDocument();
  });

  it("shows a returned confirmation mismatch beside the confirmation field", () => {
    authState.current = {
      fieldErrors: { confirmPassword: ["Passwords do not match."] },
    };
    render(<ResetPasswordForm />);

    expect(screen.getByRole("alert")).toHaveTextContent("Passwords do not match.");
    expect(screen.getByLabelText("Confirm new password")).toHaveAttribute("aria-invalid", "true");
  });
});
