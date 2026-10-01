import { describe, expect, it, vi } from "vitest";
import { PATCH } from "./route";
import { updateProgress } from "@/lib/data/videos";

vi.mock("@/lib/data/videos", () => ({ updateProgress: vi.fn() }));

const VIDEO_ID = "a0000000-0000-0000-0000-000000000001";

describe("/api/videos/[id]/progress", () => {
  it("returns the trigger-maintained last watched timestamp", async () => {
    vi.mocked(updateProgress).mockResolvedValue({ ok: true, data: {
      user_id: "u1", video_id: VIDEO_ID, last_watched_position: 12.5, completed_at: null,
      last_watched_at: "2026-10-01T10:00:00.000Z",
    } });
    const response = await PATCH(new Request(`http://localhost/api/videos/${VIDEO_ID}/progress`, {
      method: "PATCH", body: JSON.stringify({ position: 12.5 }), headers: { "content-type": "application/json" },
    }), { params: { id: VIDEO_ID } });
    await expect(response.json()).resolves.toEqual({ data: {
      user_id: "u1", video_id: VIDEO_ID, last_watched_position: 12.5, completed_at: null,
      last_watched_at: "2026-10-01T10:00:00.000Z",
    } });
  });
});
