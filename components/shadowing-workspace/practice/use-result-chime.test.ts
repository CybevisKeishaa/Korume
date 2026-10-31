import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ sounds: true, chime: vi.fn() }));
vi.mock("../workspace-context", () => ({ usePreferences: () => ({ preferences: { feedbackSounds: mock.sounds } }) }));
vi.mock("@/lib/sound/result-chime", () => ({ playResultChime: mock.chime }));

import { useResultChime } from "./use-result-chime";

describe("useResultChime", () => {
  beforeEach(() => { mock.chime.mockClear(); mock.sounds = true; });

  it("plays the band of each mode's own Summary cut", () => {
    const { result } = renderHook(() => useResultChime());
    result.current("listeningDictation", 79);
    result.current("listeningCloze", 95);
    result.current("pronunciation", 60);
    expect(mock.chime.mock.calls).toEqual([["needs_work"], ["strong"], ["practiced"]]);
  });

  it("stays silent when Result sounds is off, even for a callback created while it was on", () => {
    const { result, rerender } = renderHook(() => useResultChime());
    const early = result.current;
    mock.sounds = false;
    rerender();
    early("pronunciation", 100);
    result.current("listeningDictation", 100);
    expect(mock.chime).not.toHaveBeenCalled();
  });
});
