import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import { AuthForm } from "./auth-form";
import type { FormStatus } from "react-dom";

// AuthForm wires its <form action={...}> straight to the server actions
// module. Importing the real module here would pull in next/headers,
// next/cache and the Supabase server client, none of which work outside a
// request — mock it the same way app/[locale]/(auth)/actions.test.ts mocks
// its own dependencies, one layer down.
vi.mock("@/app/[locale]/(auth)/actions", () => ({
  login: vi.fn(),
  register: vi.fn(),
  signInWithGoogle: vi.fn(),
}));

// Overridable per test via `mockUseFormStatus.mockReturnValue(...)` (see the
// "pending state" describe below, which sets it to a FormStatusPending value
// for the duration of one test and resets it in `afterEach`). `vi.mock` calls
// are hoisted above every other statement in the file, so the factory below
// can only safely reference this if the variable itself is created through
// `vi.hoisted` — a plain top-level `const` (even "mock"-prefixed) is still in
// its temporal dead zone at that point and throws "Cannot access before
// initialization".
const { mockUseFormStatus } = vi.hoisted(() => ({
  mockUseFormStatus: vi.fn<() => FormStatus>(() => ({
    pending: false,
    data: null,
    method: null,
    action: null,
  })),
}));

// Next.js aliases "react-dom" to its own canary build (the one that ships
// useFormState/useFormStatus) at webpack build time. Vitest runs on Vite and
// resolves the plain react-dom@18.3.1 from node_modules, which has neither —
// so any render of AuthForm throws "useFormState is not a function" without
// this shim. Scoped to this file only: it stands in for the two hooks with
// enough behavior for a static-render pinning test.
//
// This shim is a new pattern in the repo (later tasks may copy it for other
// server-action forms) — one side effect to know about: because the real
// `useFormState` never runs, `<form action={formAction}>` receives a plain
// no-op function instead of the special hybrid React attaches for actions,
// so React logs an expected `Warning: Invalid value for prop \`action\` on
// <form> tag` for every render in this file. It's harmless test noise, not a
// regression — don't go debugging it.
vi.mock("react-dom", async () => {
  const actual = await vi.importActual<typeof import("react-dom")>("react-dom");
  return {
    ...actual,
    useFormState: <S,>(_action: unknown, initialState: S) => {
      const [state] = useState(initialState);
      const noopFormAction = () => undefined;
      return [state, noopFormAction, false] as const;
    },
    useFormStatus: mockUseFormStatus,
  };
});

/**
 * Characterization test, written BEFORE the `auth` namespace exists — pins
 * every static string AuthForm renders while it is still hardcoded, so
 * extraction is proven behavior-preserving if this test stays green
 * afterwards unchanged (see auth.json / vi/auth.json in the same commit).
 */
describe("AuthForm", () => {
  describe("login mode", () => {
    it("renders the sign-in fields and controls", () => {
      render(<AuthForm mode="login" />);

      expect(screen.getByLabelText("Email")).toBeInTheDocument();
      expect(screen.getByLabelText("Password")).toBeInTheDocument();
      expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();

      expect(
        screen.getByRole("button", { name: "Sign in" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Continue with Google" }),
      ).toBeInTheDocument();
      expect(screen.getByText("OR")).toBeInTheDocument();

      expect(screen.getByText("New here?")).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "Create an account" }),
      ).toBeInTheDocument();
    });
  });

  describe("register mode", () => {
    it("renders the sign-up fields and controls", () => {
      render(<AuthForm mode="register" />);

      expect(screen.getByLabelText("Name")).toBeInTheDocument();
      expect(screen.getByLabelText("Email")).toBeInTheDocument();
      expect(screen.getByLabelText("Password")).toBeInTheDocument();

      expect(
        screen.getByRole("button", { name: "Create account" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Continue with Google" }),
      ).toBeInTheDocument();
      expect(screen.getByText("OR")).toBeInTheDocument();

      expect(screen.getByText("Already have an account?")).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "Sign in" }),
      ).toBeInTheDocument();
    });
  });

  describe("pending state", () => {
    afterEach(() => {
      mockUseFormStatus.mockReturnValue({
        pending: false,
        data: null,
        method: null,
        action: null,
      });
    });

    it("swaps the submit button's accessible name to the pending label while a submission is in flight", () => {
      mockUseFormStatus.mockReturnValue({
        pending: true,
        data: new FormData(),
        method: "post",
        action: "",
      });

      render(<AuthForm mode="login" />);

      expect(
        screen.getByRole("button", { name: "Please wait…" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Sign in" }),
      ).not.toBeInTheDocument();
    });
  });
});
