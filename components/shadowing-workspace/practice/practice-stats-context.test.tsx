import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PracticeStats } from "@/lib/data/practice-stats";
import { PracticeStatsProvider, usePracticeStats } from "./practice-stats-context";

const stats: PracticeStats = { lineCount: 194, scoredLines: 12, mean: 84, lines: {} };
function Probe() {
  const value = usePracticeStats();
  return <><output>{value.stats ? JSON.stringify(value.stats) : "unavailable"}</output><button onClick={value.refresh}>Refresh</button></>;
}
function deferred() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((done) => { resolve = done; });
  return { promise, resolve };
}
const response = (data = stats) => Response.json({ data });

describe("PracticeStatsProvider", () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
  afterEach(() => vi.unstubAllGlobals());

  it("fetches only on entering pronunciation and refreshes the same lesson", async () => {
    fetchMock.mockResolvedValue(response());
    const view = render(<PracticeStatsProvider videoId="lesson-a" mode="shadowing"><Probe /></PracticeStatsProvider>);
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button"));
    expect(fetchMock).not.toHaveBeenCalled();
    view.rerender(<PracticeStatsProvider videoId="lesson-a" mode="pronunciation"><Probe /></PracticeStatsProvider>);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(JSON.stringify(stats)));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenLastCalledWith("/api/shadowing/lesson-a/practice-stats?mode=pronunciation", expect.objectContaining({ signal: expect.any(AbortSignal), cache: "no-store" }));
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await act(async () => { await Promise.resolve(); });
    view.rerender(<PracticeStatsProvider videoId="lesson-a" mode="listening"><Probe /></PracticeStatsProvider>);
    expect(screen.getByRole("status")).toHaveTextContent("unavailable");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each(["mode", "lesson"])("aborts and drops late responses after a %s change", async (change) => {
    const old = deferred();
    fetchMock.mockReturnValueOnce(old.promise).mockResolvedValue(response({ ...stats, mean: 95 }));
    const view = render(<PracticeStatsProvider videoId="lesson-a" mode="pronunciation"><Probe /></PracticeStatsProvider>);
    const signal = fetchMock.mock.calls[0]?.[1]?.signal;
    view.rerender(<PracticeStatsProvider videoId={change === "lesson" ? "lesson-b" : "lesson-a"} mode={change === "mode" ? "shadowing" : "pronunciation"}><Probe /></PracticeStatsProvider>);
    expect(signal?.aborted).toBe(true);
    if (change === "lesson") await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent('"mean":95'));
    await act(async () => { old.resolve(response()); });
    expect(screen.getByRole("status")).toHaveTextContent(change === "lesson" ? '"mean":95' : "unavailable");
  });

  it("prevents an older refresh from overwriting a newer result even when fetch ignores abort", async () => {
    const old = deferred();
    fetchMock.mockResolvedValueOnce(response()).mockReturnValueOnce(old.promise).mockResolvedValueOnce(response({ ...stats, mean: 95 }));
    render(<PracticeStatsProvider videoId="lesson-a" mode="pronunciation"><Probe /></PracticeStatsProvider>);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent('"mean":84'));
    fireEvent.click(screen.getByRole("button"));
    const signal = fetchMock.mock.calls[1]?.[1]?.signal;
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent('"mean":95'));
    expect(signal?.aborted).toBe(true);
    await act(async () => { old.resolve(response({ ...stats, mean: 50 })); });
    expect(screen.getByRole("status")).toHaveTextContent('"mean":95');
  });

  it.each(["http", "network", "json"])("leaves stats unavailable on a %s failure and allows retry", async (failure) => {
    if (failure === "http") fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    else if (failure === "network") fetchMock.mockRejectedValueOnce(new Error("offline"));
    else fetchMock.mockResolvedValueOnce(new Response("invalid json"));
    fetchMock.mockResolvedValue(response());
    render(<PracticeStatsProvider videoId="lesson-a" mode="pronunciation"><Probe /></PracticeStatsProvider>);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole("status")).toHaveTextContent("unavailable");
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent('"mean":84'));
  });

  it("aborts an outstanding request on unmount", () => {
    fetchMock.mockReturnValue(new Promise(() => { /* Keep the request pending until unmount. */ }));
    const view = render(<PracticeStatsProvider videoId="lesson-a" mode="pronunciation"><Probe /></PracticeStatsProvider>);
    const signal = fetchMock.mock.calls[0]?.[1]?.signal;
    view.unmount();
    expect(signal?.aborted).toBe(true);
  });
});
