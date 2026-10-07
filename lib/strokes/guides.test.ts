import { beforeEach, describe, expect, it, vi } from "vitest";

const query = { select: vi.fn(), eq: vi.fn(), in: vi.fn() };
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => ({ from: () => query }) }));
vi.mock("@/lib/dictionary/snapshot", () => ({ getActiveSnapshotId: vi.fn(async () => "snap-1") }));

import { getActiveSnapshotId } from "@/lib/dictionary/snapshot";
import { getStrokeGuides, strokeStart } from "./guides";

beforeEach(() => {
  vi.clearAllMocks();
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.in.mockResolvedValue({ data: [
    { literal: "人", paths: ["M54.5,20c0.37,2.12-0.22,6.27", "m 55 50 c 1 1 2 2 3 3"] },
    { literal: "し", paths: ["c1,2,3,4"] },
  ], error: null });
});

describe("strokeStart (spec W §1.1)", () => {
  it("reads the first absolute or relative move", () => {
    expect(strokeStart("M54.5,20c0.37,2.12")).toEqual([54.5, 20]);
    expect(strokeStart("  m 55 50 c 1 1")).toEqual([55, 50]);
    expect(strokeStart("M-1.5.5L2,3")).toEqual([-1.5, 0.5]);
  });
  it("is null for a path that does not start with a move", () => {
    expect(strokeStart("c1,2,3,4")).toBeNull();
  });
});

describe("getStrokeGuides (spec W §1.1)", () => {
  it("reads the active snapshot once, keeps KanjiVG order, and omits characters without a row", async () => {
    const guides = await getStrokeGuides(["人", "し", "T", "人"]);
    expect(query.eq).toHaveBeenCalledWith("snapshot_id", "snap-1");
    expect(query.in).toHaveBeenCalledWith("literal", ["人", "し", "T"]);
    expect(guides["人"]?.strokes.map((stroke) => stroke.start)).toEqual([[54.5, 20], [55, 50]]);
    expect(guides["人"]?.viewBox).toBe(109);
    expect(guides["し"]?.strokes[0]?.start).toBeNull(); // drawn, never numbered
    expect(guides.T).toBeUndefined();
  });
  it("returns nothing without an active snapshot or characters, without querying", async () => {
    vi.mocked(getActiveSnapshotId).mockResolvedValueOnce(null);
    expect(await getStrokeGuides(["人"])).toEqual({});
    expect(await getStrokeGuides([])).toEqual({});
    expect(query.in).not.toHaveBeenCalled();
  });
});
