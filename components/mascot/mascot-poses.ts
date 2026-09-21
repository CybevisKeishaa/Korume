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
  login: { file: "greeting.png", width: 200, height: 272 },
  register: { file: "excited.png", width: 436, height: 364 },
  "forgot-password": { file: "thinking.png", width: 427, height: 406 },
  "verify-email": { file: "noting.png", width: 340, height: 304 },
  "reset-password": { file: "looking-ahead.png", width: 620, height: 1015 },
  "not-found": { file: "curious-question-mark.png", width: 423, height: 370 },
  "route-error": { file: "worry.png", width: 370, height: 397 },
};
