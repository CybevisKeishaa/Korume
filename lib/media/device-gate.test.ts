import { describe, expect, it } from "vitest";
import { DEFAULT_PREFERENCES } from "@/lib/preferences/options";
import { canUseDevice } from "./device-gate";

const prefs = (microphoneEnabled: boolean, cameraEnabled: boolean) => ({
  microphoneEnabled,
  cameraEnabled,
});

describe("canUseDevice", () => {
  it.each([
    [true, true, "microphone", true],
    [true, true, "camera", true],
    [false, true, "microphone", false],
    [false, true, "camera", true],
    [true, false, "microphone", true],
    [true, false, "camera", false],
    [false, false, "microphone", false],
    [false, false, "camera", false],
  ] as const)(
    "mic %s / camera %s allows %s: %s",
    (microphoneEnabled, cameraEnabled, device, expected) => {
      expect(canUseDevice(prefs(microphoneEnabled, cameraEnabled), device)).toBe(expected);
    },
  );

  it("reads each device from its own field, so the two cannot be swapped", () => {
    expect(canUseDevice(prefs(true, false), "microphone")).not.toBe(
      canUseDevice(prefs(true, false), "camera"),
    );
  });

  it("allows both under the shipped defaults", () => {
    // The gate must not change behaviour for an account that has never opened
    // Settings: microphone on, camera off (spec §3).
    expect(canUseDevice(DEFAULT_PREFERENCES, "microphone")).toBe(true);
    expect(canUseDevice(DEFAULT_PREFERENCES, "camera")).toBe(false);
  });
});
