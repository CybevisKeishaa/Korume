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
 * The toggle's initial state is read server-side by `page.tsx` via
 * `lib/data/model-training-consent.ts`'s `getModelTrainingConsent` (no `GET`
 * route — the page reads the DB directly) and threaded in as `initialConsent`
 * — never fetched by this client component itself.
 */
describe("AiTrainingToggle", () => {
  it("renders checked when the caller already opted in", () => {
    mockFetchOnce({ ok: true, status: 200 });
    render(<AiTrainingToggle initialConsent />);
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText("Help improve Korume's models")).toBeInTheDocument();
    expect(screen.getByText(/that is not model training/i)).toBeInTheDocument();
  });

  it("renders unchecked when the caller has not opted in (or the read failed closed)", () => {
    mockFetchOnce({ ok: true, status: 200 });
    render(<AiTrainingToggle initialConsent={false} />);
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
  });

  it("PATCHes consent: true when turned on", async () => {
    const fetchSpy = mockFetchOnce({ ok: true, status: 200 });
    render(<AiTrainingToggle initialConsent={false} />);

    await userEvent.click(screen.getByRole("checkbox"));

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/user/model-training-consent",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ consent: true }) }),
    );
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
  });

  it("PATCHes consent: false when an already-opted-in toggle is turned off", async () => {
    const fetchSpy = mockFetchOnce({ ok: true, status: 200 });
    render(<AiTrainingToggle initialConsent />);

    await userEvent.click(screen.getByRole("checkbox"));

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/user/model-training-consent",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ consent: false }) }),
    );
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
  });

  it("rolls back and shows a translated error on failure, never a server string", async () => {
    mockFetchOnce({ ok: false, status: 500 });
    render(<AiTrainingToggle initialConsent={false} />);
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;

    await userEvent.click(checkbox);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(checkbox.checked).toBe(false);
  });

  it("is keyboard operable", async () => {
    mockFetchOnce({ ok: true, status: 200 });
    render(<AiTrainingToggle initialConsent={false} />);

    await userEvent.tab();
    await userEvent.keyboard(" ");

    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
  });
});
