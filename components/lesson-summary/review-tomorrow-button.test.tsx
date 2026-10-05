import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import { ReviewTomorrowButton } from "./review-tomorrow-button";

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

afterEach(() => vi.unstubAllGlobals());

describe("ReviewTomorrowButton", () => {
  it("POSTs the browser time zone to the lesson's review-tomorrow route", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    render(<ReviewTomorrowButton videoId="v-1" reviewTargetTotal={3} />);
    fireEvent.click(screen.getByRole("button", { name: "Review Tomorrow" }));
    await flush();
    expect(fetchMock).toHaveBeenCalledWith("/api/videos/v-1/review-tomorrow", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
    }));
  });

  it("on 200: scheduled label, aria-disabled (not disabled), keeps focus, announces, and sends nothing more", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    render(<ReviewTomorrowButton videoId="v-1" reviewTargetTotal={3} />);
    const button = screen.getByRole("button", { name: "Review Tomorrow" });
    button.focus();
    fireEvent.click(button);
    await flush();
    expect(button).toHaveTextContent("Scheduled for tomorrow ✓");
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toHaveAttribute("disabled");
    expect(button).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("Scheduled for tomorrow ✓");
    fireEvent.click(button);
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("on error: shows the retry copy and stays active", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    render(<ReviewTomorrowButton videoId="v-1" reviewTargetTotal={3} />);
    const button = screen.getByRole("button", { name: "Review Tomorrow" });
    fireEvent.click(button);
    await flush();
    expect(screen.getByRole("alert")).toHaveTextContent("Could not schedule the review. Try again.");
    expect(button).not.toHaveAttribute("aria-disabled");
    fireEvent.click(button);
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("is not rendered when the lesson has no review targets", () => {
    render(<ReviewTomorrowButton videoId="v-1" reviewTargetTotal={0} />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
