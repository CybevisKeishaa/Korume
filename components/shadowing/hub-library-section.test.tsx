import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/test/render";
import userEvent from "@testing-library/user-event";
import { HubLibrarySection } from "./hub-library-section";

const lesson = { id: "failed", youtubeVideoId: "yt-failed", title: "Missing captions", durationSeconds: null, thumbnailUrl: null, jlptLevelEstimate: null };
const refresh = vi.fn();
const labels = { title: "My lessons", readyAction: "Open", unavailable: "Transcript unavailable", retry: "Try again", retryPending: "Retrying captions\u2026", retryFailed: "Couldn't retry captions. Try again.", noThumbnail: "No thumbnail", emptyTitle: "Your lesson library is ready", emptyBody: "Import a lesson to begin building your library.", emptyAction: "Import a lesson" };

vi.mock("@/lib/i18n/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/i18n/navigation")>()),
  useRouter: () => ({ refresh }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  refresh.mockClear();
});

describe("HubLibrarySection", () => {
  it("keeps My Lessons visible with the real import action when the library is empty", () => {
    render(<HubLibrarySection items={[]} labels={labels} />);

    expect(screen.getByRole("region", { name: "My lessons" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your lesson library is ready" })).toBeInTheDocument();
    expect(screen.getByText("Import a lesson to begin building your library.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Import a lesson" })).toHaveAttribute("href", "#hub-import");
  });

  it("allows Explore to route its empty-library action to the Hub import section", () => {
    render(<HubLibrarySection items={[]} labels={labels} emptyActionHref="/shadowing#hub-import" />);

    expect(screen.getByRole("link", { name: "Import a lesson" })).toHaveAttribute("href", "/shadowing#hub-import");
  });

  it("links a ready lesson to its shadowing workspace", () => {
    render(
      <HubLibrarySection
        items={[{ lesson, state: "ready" }]}
        labels={labels}
      />,
    );

    expect(screen.getByRole("link", { name: "Open: Missing captions" })).toHaveAttribute("href", "/en/shadowing/failed");
  });

  it("shows an unavailable lesson honestly without job percentage or ETA", () => {
    render(<HubLibrarySection items={[{ lesson, state: "unavailable" }]} labels={labels} />);
    expect(screen.getByText("Transcript unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.queryByText(/%|ETA|estimated/i)).not.toBeInTheDocument();
  });

  it("retries the existing import and refreshes the authoritative Hub state", async () => {
    let resolveFetch!: (value: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pending));

    render(<HubLibrarySection items={[{ lesson, state: "unavailable" }]} labels={labels} />);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(screen.getByRole("button", { name: "Retrying captions\u2026" })).toBeDisabled();
    expect(screen.queryByText(/%|ETA|estimated/i)).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/videos/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ youtubeUrl: "https://www.youtube.com/watch?v=yt-failed" }),
    });

    resolveFetch({ ok: true } as Response);
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  });

  it("announces a retry failure and leaves the lesson available for another attempt", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false } as Response));

    render(<HubLibrarySection items={[{ lesson, state: "unavailable" }]} labels={labels} />);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't retry captions. Try again.");
    expect(screen.getByRole("button", { name: "Try again" })).not.toBeDisabled();
  });
});
