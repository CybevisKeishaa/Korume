import { useState } from "react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import type { FormStatus } from "react-dom";
import { RegisterForm } from "./register-form";

vi.mock("@/app/[locale]/(auth)/actions", () => ({
  login: vi.fn(),
  register: vi.fn(),
  signInWithGoogle: vi.fn(),
}));

const { mockUseFormStatus } = vi.hoisted(() => ({
  mockUseFormStatus: vi.fn<() => FormStatus>(() => ({
    pending: false,
    data: null,
    method: null,
    action: null,
  })),
}));

vi.mock("react-dom", async () => {
  const actual = await vi.importActual<typeof import("react-dom")>("react-dom");
  return {
    ...actual,
    useFormState: <S,>(_action: unknown, initialState: S) => {
      const [state] = useState(initialState);
      return [state, () => undefined, false] as const;
    },
    useFormStatus: mockUseFormStatus,
  };
});

describe("RegisterForm", () => {
  it("renders registration fields and the existing account controls", () => {
    render(<RegisterForm />);

    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password", { exact: true })).toHaveAttribute("autocomplete", "new-password");
    expect(screen.getByLabelText("Confirm password")).toHaveAttribute("autocomplete", "new-password");
    expect(screen.getByRole("button", { name: "Create account" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
    expect(screen.getByText("OR")).toBeInTheDocument();
    expect(screen.getByText("Already have an account?")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/en/login");
  });

  it("toggles each password field independently", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    const password = screen.getByLabelText("Password", { exact: true });
    const confirmation = screen.getByLabelText("Confirm password");
    const toggles = screen.getAllByRole("button", { name: "Show password" });

    const [passwordToggle, confirmationToggle] = toggles;
    expect(passwordToggle).toBeDefined();
    expect(confirmationToggle).toBeDefined();
    if (!passwordToggle || !confirmationToggle) throw new Error("Expected password toggles");
    await user.click(passwordToggle);

    expect(password).toHaveAttribute("type", "text");
    expect(passwordToggle).toHaveAccessibleName("Hide password");
    expect(confirmation).toHaveAttribute("type", "password");
    expect(confirmationToggle).toHaveAccessibleName("Show password");
  });
});
