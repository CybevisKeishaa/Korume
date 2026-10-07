import { afterEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { StudyTimezoneDetector } from "./study-timezone-detector";

afterEach(() => vi.restoreAllMocks());
describe("StudyTimezoneDetector", () => {
  it("does nothing when the account already has a zone", () => {
    const fetch = vi.spyOn(global, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
    render(<StudyTimezoneDetector needsDetection={false} />);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("proposes the browser zone once when detection is needed", async () => {
    const fetch = vi.spyOn(global, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    render(<StudyTimezoneDetector needsDetection />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith("/api/user/study-timezone", expect.objectContaining({
      method: "POST", body: JSON.stringify({ timeZone: zone }), keepalive: true,
    }));
  });
});
