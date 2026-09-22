import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import type { FormStatus } from "react-dom";
import { LoginForm } from "./login-form";

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

describe("LoginForm", () => {
  afterEach(() => {
    mockUseFormStatus.mockReturnValue({
      pending: false,
      data: null,
      method: null,
      action: null,
    });
  });

  it("renders the sign-in controls with the supplied redirect", () => {
    const { container } = render(<LoginForm redirectTo="/en/review" />);

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password", { exact: true })).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
    expect(container.querySelector('input[name="redirectTo"]')).toHaveValue("/en/review");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
    expect(screen.getByText("OR")).toBeInTheDocument();
    expect(screen.getByText("New here?")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/en/register");
    expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute(
      "href",
      "/en/forgot-password",
    );
  });

  it("shows the pending label while a submission is in flight", () => {
    mockUseFormStatus.mockReturnValue({
      pending: true,
      data: new FormData(),
      method: "post",
      action: "",
    });

    render(<LoginForm />);

    expect(screen.getByRole("button", { name: "Please wait…" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign in" })).not.toBeInTheDocument();
  });
});
