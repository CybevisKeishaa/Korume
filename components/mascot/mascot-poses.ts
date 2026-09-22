/**
 * The only place a screen's semantic state maps to a pose file (spec §5.4). Auth and error
 * surfaces both import this module, which is why it lives outside `components/auth/`.
 * `width`/`height` are the PNG's pixel size, pinned by the test against the file itself.
 */
export type MascotPoseName =
  | "login"
  | "register"
  | "forgot-password"
  | "verify-email"
  | "reset-password"
  | "not-found"
  | "route-error";

export const MASCOT_POSES: Record<MascotPoseName, { file: string; width: number; height: number }> = {
  login: { file: "bye.png", width: 572, height: 436 },
  register: { file: "excited.png", width: 436, height: 364 },
  "forgot-password": { file: "thinking.png", width: 427, height: 406 },
  "verify-email": { file: "quill-writing.png", width: 495, height: 424 },
  "reset-password": { file: "proud.png", width: 442, height: 406 },
  "not-found": { file: "curious-question-mark.png", width: 423, height: 370 },
  "route-error": { file: "worry.png", width: 370, height: 397 },
};
