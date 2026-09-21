import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import { LoginForm } from "./login-form";
import { RegisterForm } from "./register-form";

vi.mock("@/app/[locale]/(auth)/actions", () => ({
  login: vi.fn(),
  register: vi.fn(),
  signInWithGoogle: vi.fn(),
}));

vi.mock("react-dom", async () => {
  const actual = await vi.importActual<typeof import("react-dom")>("react-dom");
  return {
    ...actual,
    useFormState: <S,>(_action: unknown, initialState: S) => {
      const [state] = useState(initialState);
      return [state, () => undefined, false] as const;
    },
    useFormStatus: () => ({ pending: false, data: null, method: null, action: null }),
  };
});

describe("auth providers", () => {
  it("renders Google without Apple or GitHub controls", () => {
    render(<><LoginForm /><RegisterForm /></>);

    const controls = [
      ...screen.queryAllByRole("button"),
      ...screen.queryAllByRole("link"),
    ];
    expect(controls).not.toHaveLength(0);
    expect(controls.some((control) => /apple|github/i.test(control.getAttribute("aria-label") ?? control.textContent ?? ""))).toBe(false);
  });
});
