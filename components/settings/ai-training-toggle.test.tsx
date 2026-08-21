import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/test/render";
import { AiTrainingToggle } from "./ai-training-toggle";

function mockFetchOnce(response: { ok: boolean; status: number }): ReturnType<typeof vi.fn> {
  const fn = vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status,
    json: async () => ({}),
  } as Response);
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Task 7 shipped `PATCH /api/user/model-training-consent` only — there is no
 * GET, so this toggle cannot read a persisted "on" state and starts
 * unchecked, matching `users.model_training_consent`'s own default. That gap
 * is documented in the component, not hidden.
 */
describe("AiTrainingToggle", () => {
  it("starts unchecked and names what the flag actually covers", () => {
    mockFetchOnce({ ok: true, status: 200 });
    render(<AiTrainingToggle />);
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText("Help improve Korume's models")).toBeInTheDocument();
    expect(screen.getByText(/that is not model training/i)).toBeInTheDocument();
  });

  it("PATCHes consent: true when turned on", async () => {
    const fetchSpy = mockFetchOnce({ ok: true, status: 200 });
    render(<AiTrainingToggle />);

    await userEvent.click(screen.getByRole("checkbox"));

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/user/model-training-consent",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ consent: true }) }),
    );
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
  });

  it("rolls back and shows a translated error on failure, never a server string", async () => {
    mockFetchOnce({ ok: false, status: 500 });
    render(<AiTrainingToggle />);
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;

    await userEvent.click(checkbox);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(checkbox.checked).toBe(false);
  });

  it("is keyboard operable", async () => {
    mockFetchOnce({ ok: true, status: 200 });
    render(<AiTrainingToggle />);

    await userEvent.tab();
    await userEvent.keyboard(" ");

    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
  });
});
