import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import userEvent from "@testing-library/user-event";
import { LeaderboardOptInToggle } from "./leaderboard-opt-in-toggle";

function mockFetchOnce(response: { ok: boolean; status: number; headers?: Record<string, string>; json?: () => Promise<unknown> }): ReturnType<typeof vi.fn> {
  const fn = vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status,
    headers: new Headers(response.headers ?? {}),
    json: response.json ?? (async () => ({})),
  } as Response);
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LeaderboardOptInToggle", () => {
  it("explains what opting in does", () => {
    mockFetchOnce({ ok: true, status: 200 });
    render(<LeaderboardOptInToggle initialOptIn={false} onChanged={vi.fn()} />);
    expect(screen.getByText(/your name and weekly xp will be visible/i)).toBeInTheDocument();
  });

  // Swap-proof (Task 16 audit convention #3): the bold consent QUESTION and
  // the muted-text explanation are two adjacent, same-shape spans — a plain
  // "does this text exist" check (above) still passes even if their content
  // is swapped, since both strings still render somewhere in the label. This
  // pins each string to its own element by class, catching that swap.
  it("renders the consent question in the bold span and the explanation in the muted span (not swapped)", () => {
    mockFetchOnce({ ok: true, status: 200 });
    const { container } = render(<LeaderboardOptInToggle initialOptIn={false} onChanged={vi.fn()} />);
    expect(container.querySelector(".font-medium")).toHaveTextContent("Appear on the leaderboard?");
    expect(container.querySelector(".text-xs.text-muted-foreground")).toHaveTextContent(
      "Your name and weekly XP will be visible to other users.",
    );
  });

  it("PATCHes optIn: true when toggled on and notifies the parent", async () => {
    const fetchSpy = mockFetchOnce({ ok: true, status: 200, json: async () => ({ data: { optIn: true } }) });
    const onChanged = vi.fn();
    render(<LeaderboardOptInToggle initialOptIn={false} onChanged={onChanged} />);

    await userEvent.click(screen.getByRole("checkbox", { name: /appear on the leaderboard/i }));

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/user/leaderboard-opt-in",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ optIn: true }) }),
    );
    expect(onChanged).toHaveBeenCalledWith(true);
  });

  it("rolls back on failure", async () => {
    mockFetchOnce({ ok: false, status: 401 });
    render(<LeaderboardOptInToggle initialOptIn={false} onChanged={vi.fn()} />);

    const checkbox = screen.getByRole("checkbox", { name: /appear on the leaderboard/i }) as HTMLInputElement;
    await userEvent.click(checkbox);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(checkbox.checked).toBe(false);
  });
});
