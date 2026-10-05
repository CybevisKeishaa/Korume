import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePolledResource, type PollPolicy } from "./use-polled-resource";

type Body = { state: "not_ready" | "pending" | "ready" | "unavailable"; retryAfterMs?: number };
const policy: PollPolicy<Body> = {
  waitMs: (body) => (body.state === "pending" ? body.retryAfterMs ?? 0 : null),
  needsPost: (body) => body.state === "not_ready",
};

function Probe() {
  const resource = usePolledResource<Body>({ url: "/analysis?locale=en", postBody: { locale: "en" }, enabled: true, policy });
  return (
    <>
      <output>{resource.body?.state ?? "none"}</output>
      <span data-testid="settled">{String(resource.settled)}</span>
      <button onClick={resource.retry}>retry</button>
    </>
  );
}

const reply = (body: Body) => Promise.resolve({ json: async () => body });
const calls = (mock: ReturnType<typeof vi.fn>) => mock.mock.calls.map(([url, init]) => [url, (init as RequestInit).method]);
const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("usePolledResource", () => {
  it("runs GET 404 not_ready → POST pending(1500) → wait → GET ready, in that order, and settles", async () => {
    const fetchMock = vi.fn()
      .mockReturnValueOnce(reply({ state: "not_ready" }))
      .mockReturnValueOnce(reply({ state: "pending", retryAfterMs: 1500 }))
      .mockReturnValueOnce(reply({ state: "ready" }));
    vi.stubGlobal("fetch", fetchMock);
    render(<Probe />);
    await flush();
    expect(calls(fetchMock)).toEqual([["/analysis?locale=en", "GET"], ["/analysis", "POST"]]);
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ body: JSON.stringify({ locale: "en" }) });
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(calls(fetchMock)).toEqual([["/analysis?locale=en", "GET"], ["/analysis", "POST"], ["/analysis?locale=en", "GET"]]);
    expect(screen.getByRole("status")).toHaveTextContent("ready");
    expect(screen.getByTestId("settled")).toHaveTextContent("true");
  });

  it("starts no second chain when re-rendered with the same props during a wait", async () => {
    const fetchMock = vi.fn(() => reply({ state: "pending", retryAfterMs: 1000 }));
    vi.stubGlobal("fetch", fetchMock);
    const view = render(<Probe />);
    await flush();
    view.rerender(<Probe />);
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("aborts the in-flight request and clears the timer on unmount", async () => {
    const signals: AbortSignal[] = [];
    const fetchMock = vi.fn((_url: string, init: RequestInit) => {
      signals.push(init.signal as AbortSignal);
      return reply({ state: "pending", retryAfterMs: 1000 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const view = render(<Probe />);
    await flush();
    view.unmount();
    expect(signals[0]?.aborted).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("makes no request before waitMs and exactly one right after", async () => {
    const fetchMock = vi.fn()
      .mockReturnValueOnce(reply({ state: "pending", retryAfterMs: 1000 }))
      .mockReturnValue(reply({ state: "ready" }));
    vi.stubGlobal("fetch", fetchMock);
    render(<Probe />);
    await flush();
    await act(async () => { await vi.advanceTimersByTimeAsync(999); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("ends the chain on a terminal body; retry() starts a new chain with a POST", async () => {
    const fetchMock = vi.fn(() => reply({ state: "unavailable" }));
    vi.stubGlobal("fetch", fetchMock);
    render(<Probe />);
    await flush();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(calls(fetchMock)).toEqual([["/analysis?locale=en", "GET"]]);
    fireEvent.click(screen.getByRole("button", { name: "retry" }));
    await flush();
    expect(calls(fetchMock)).toEqual([["/analysis?locale=en", "GET"], ["/analysis", "POST"]]);
  });

  it("stops after the default 3 POSTs when the server keeps answering not_ready, and settles", async () => {
    const fetchMock = vi.fn(() => reply({ state: "not_ready" }));
    vi.stubGlobal("fetch", fetchMock);
    render(<Probe />);
    await flush();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(calls(fetchMock).filter(([, method]) => method === "POST")).toHaveLength(3);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(screen.getByTestId("settled")).toHaveTextContent("true");
  });
});
