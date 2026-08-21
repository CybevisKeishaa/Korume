import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/test/render";
import { AiTrainingToggle } from "./ai-training-toggle";

/**
 * A real `Response`, matching `delete-data-dialog.test.tsx`'s pattern —
 * fix round 2, minor #2: the previous version hand-rolled `{ ok, status,
 * json }` cast to `Response`, which models less of the real contract (e.g.
 * `response.ok` was asserted by the caller rather than derived from
 * `status`, same as the real thing does) and was named `mockFetchOnce`
 * while actually being a `mockResolvedValue` (applies to every call, not
 * once).
 */
function mockFetch(status: number): ReturnType<typeof vi.fn> {
  const fn = vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/**
 * The toggle's initial state is read server-side by `page.tsx` via
 * `lib/data/model-training-consent.ts`'s `getModelTrainingConsent` (no `GET`
 * route — the page reads the DB directly) and threaded in as `initialConsent`
 * — never fetched by this client component itself.
 */
describe("AiTrainingToggle", () => {
  it("renders checked when the caller already opted in", () => {
    mockFetch(200);
    render(<AiTrainingToggle initialConsent />);
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText("Help improve Korume's models")).toBeInTheDocument();
    expect(screen.getByText(/that is not model training/i)).toBeInTheDocument();
  });

  it("renders unchecked when the caller has not opted in (or the read failed closed)", () => {
    mockFetch(200);
    render(<AiTrainingToggle initialConsent={false} />);
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
  });

  it("PATCHes consent: true when turned on", async () => {
    const fetchSpy = mockFetch(200);
    render(<AiTrainingToggle initialConsent={false} />);

    await userEvent.click(screen.getByRole("checkbox"));

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/user/model-training-consent",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ consent: true }) }),
    );
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
  });

  it("PATCHes consent: false when an already-opted-in toggle is turned off", async () => {
    const fetchSpy = mockFetch(200);
    render(<AiTrainingToggle initialConsent />);

    await userEvent.click(screen.getByRole("checkbox"));

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/user/model-training-consent",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ consent: false }) }),
    );
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
  });

  it("rolls back and shows a translated error on failure, never a server string", async () => {
    mockFetch(500);
    render(<AiTrainingToggle initialConsent={false} />);
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;

    await userEvent.click(checkbox);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(checkbox.checked).toBe(false);
  });

  /**
   * Fix round 2, minor #1: the one path where the never-render-a-server-
   * string guarantee was previously unexercised anywhere in the suite — a
   * rejected fetch (dropped connection, offline, etc.) never even reaches a
   * response to read a status from.
   */
  it("rolls back and shows the translated network error when fetch itself rejects", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    render(<AiTrainingToggle initialConsent={false} />);
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;

    await userEvent.click(checkbox);

    const alert = await screen.findByRole("alert");
    expect(alert).not.toHaveTextContent("Failed to fetch");
    expect(alert).not.toHaveTextContent("TypeError");
    expect(checkbox.checked).toBe(false);
  });

  it("is keyboard operable", async () => {
    mockFetch(200);
    render(<AiTrainingToggle initialConsent={false} />);

    await userEvent.tab();
    await userEvent.keyboard(" ");

    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
  });
});
