import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import type { FormStatus } from "react-dom";
import type { ResendState } from "@/app/[locale]/(auth)/actions";
import { VerifyEmailForm } from "./verify-email-form";

const { resendCode, verifyEmail, resendState } = vi.hoisted(() => ({
  resendCode: vi.fn(),
  verifyEmail: vi.fn(),
  resendState: { current: {} as ResendState },
}));

vi.mock("@/app/[locale]/(auth)/actions", () => ({ resendCode, verifyEmail }));

vi.mock("react-dom", async () => {
  const actual = await vi.importActual<typeof import("react-dom")>("react-dom");
  return {
    ...actual,
    useFormState: <S,>(action: unknown, initialState: S) => [
      action === resendCode ? resendState.current : initialState,
      "/",
      false,
    ] as const,
    useFormStatus: (): FormStatus => ({
      pending: false,
      data: null,
      method: null,
      action: null,
    }),
  };
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  resendState.current = {};
});

afterEach(() => {
  vi.useRealTimers();
});

describe("VerifyEmailForm", () => {
  it("keeps the email as visible text and a hidden field in both forms", () => {
    const { container } = render(<VerifyEmailForm email="a@b.com" initialCooldown />);

    expect(screen.getByText("a@b.com")).toBeInTheDocument();
    expect(container.querySelectorAll('input[type="hidden"][name="email"]')).toHaveLength(2);
    container
      .querySelectorAll<HTMLInputElement>('input[type="hidden"][name="email"]')
      .forEach((input) => expect(input).toHaveValue("a@b.com"));
  });

  it("counts down from the initial 60-second cooldown", () => {
    render(<VerifyEmailForm email="a@b.com" initialCooldown />);

    expect(screen.getByRole("button", { name: "Resend code in 60s" })).toBeDisabled();
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByRole("button", { name: "Resend code" })).toBeEnabled();
  });

  it("starts enabled from resend=1 without submitting on render", () => {
    render(<VerifyEmailForm email="a@b.com" initialCooldown={false} />);

    expect(screen.getByRole("button", { name: "Resend code" })).toBeEnabled();
    expect(resendCode).not.toHaveBeenCalled();
  });

  it("links Change email to a bare register route and never shows expiry copy", () => {
    render(<VerifyEmailForm email="a@b.com" initialCooldown={false} />);

    expect(screen.getByRole("link", { name: "Wrong email? Change email" })).toHaveAttribute(
      "href",
      "/en/register",
    );
    expect(screen.queryByText(/expire/i)).not.toBeInTheDocument();
  });

  it("restarts the cooldown for each new successful resend state", () => {
    const { rerender } = render(<VerifyEmailForm email="a@b.com" initialCooldown={false} />);
    resendState.current = { status: "sent" };
    rerender(<VerifyEmailForm email="a@b.com" initialCooldown={false} />);
    expect(screen.getByRole("button", { name: "Resend code in 60s" })).toBeDisabled();

    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.getByRole("button", { name: "Resend code in 59s" })).toBeDisabled();

    rerender(<VerifyEmailForm email="a@b.com" initialCooldown={false} />);
    expect(screen.getByRole("button", { name: "Resend code in 59s" })).toBeDisabled();

    resendState.current = { status: "sent" };
    rerender(<VerifyEmailForm email="a@b.com" initialCooldown={false} />);
    expect(screen.getByRole("button", { name: "Resend code in 60s" })).toBeDisabled();
  });
});
