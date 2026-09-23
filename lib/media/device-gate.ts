import type { UserPreferences } from "@/lib/preferences/options";

export type CaptureDevice = "microphone" | "camera";

/**
 * Korume's own switch for a capture device, which is not the browser
 * permission (settings spec §1.5, §4.4). The browser answers "may this origin
 * use the device"; this answers "does the reader want Korume to", and the
 * reader's answer is checked first so a disabled device never produces a
 * permission prompt.
 *
 * **Every feature that opens a microphone or a camera must call this**, not
 * just the shadowing recorder — a switch that only one surface honours is
 * worse than none, because it reads as a promise the product does not keep.
 */
export function canUseDevice(
  prefs: Pick<UserPreferences, "microphoneEnabled" | "cameraEnabled">,
  device: CaptureDevice,
): boolean {
  return device === "microphone" ? prefs.microphoneEnabled : prefs.cameraEnabled;
}
