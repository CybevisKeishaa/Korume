import type { KorumeMood } from "@/lib/practice/korume-mood";

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
  | "route-error"
  | "settings"
  | "korumeship"
  | "edit-footer"
  // The Companion's own art, by CompanionPose (companion-sprite.tsx).
  | "companion-sitting"
  | "companion-standing"
  | "companion-reading"
  // Korume's reaction to a practice result, by KorumeMood (lib/practice/korume-mood.ts, practice-korume.tsx).
  | `korume-${KorumeMood}`;

export const MASCOT_POSES: Record<MascotPoseName, { file: string; width: number; height: number }> = {
  login: { file: "bye.png", width: 572, height: 436 },
  register: { file: "excited.png", width: 436, height: 364 },
  "forgot-password": { file: "thinking.png", width: 427, height: 406 },
  "verify-email": { file: "quill-writing.png", width: 495, height: 424 },
  "reset-password": { file: "proud.png", width: 442, height: 406 },
  "not-found": { file: "curious-question-mark.png", width: 423, height: 370 },
  "route-error": { file: "worry.png", width: 370, height: 397 },
  // `relax.png` ("THƯ GIÃN — relaxed, eyes closed"), for the Settings header's
  // "Personal space · A quiet place to make Korume feel more like yours".
  // A `supplied` hand-cut pose, per the owner's ruling that the extractor-cut
  // `poses` entries read as broken. One line to change if they prefer another.
  settings: { file: "relax.png", width: 423, height: 375 },
  // The companion sitting on its orb with a scroll: the Profile Korumeship card's opening art (Figma 66:166).
  korumeship: { file: "reading-on-the-orb.png", width: 412, height: 454 },
  // The Edit Profile footer (Figma 67:595): the companion holding a glowing charm, beside "Korume will use these choices..." (spec 8.3).
  // Owner review 2026-10-08: replaced holding-memory.png, whose extractor cut read as broken at size sm.
  "edit-footer": { file: "syncing.png", width: 330, height: 300 },
  "companion-sitting": { file: "happy.png", width: 408, height: 376 },
  "companion-standing": { file: "neutral.png", width: 436, height: 381 },
  "companion-reading": { file: "reading-on-the-orb.png", width: 412, height: 454 },
  // The owner's emotion poses (2026-11-03): one pose per mood, chosen by korumeMood.
  "korume-ace": { file: "chinh-xac.png", width: 412, height: 270 },
  "korume-smug": { file: "tu-hao.png", width: 289, height: 268 },
  "korume-hype": { file: "cuoi-phan-khich.png", width: 279, height: 300 },
  "korume-proud": { file: "tu-hao-hanh-dien.png", width: 326, height: 300 },
  "korume-comeback": { file: "tien-len.png", width: 340, height: 300 },
  "korume-giggle": { file: "cuoi-che-mieng.png", width: 226, height: 300 },
  "korume-laugh": { file: "cuoi-nac-ne.png", width: 300, height: 254 },
  "korume-improved": { file: "nhay-mat.png", width: 336, height: 296 },
  "korume-close": { file: "hmm.png", width: 347, height: 256 },
  "korume-focus": { file: "quyet-tam-cao-do.png", width: 394, height: 300 },
  "korume-sulk": { file: "gian-doi-mat-xi.png", width: 240, height: 223 },
  "korume-tantrum": { file: "tuc-gian-dap-tay-xuong-dat.png", width: 268, height: 300 },
  "korume-dizzy": { file: "choang-vang.png", width: 219, height: 243 },
  "korume-cry": { file: "khoc.png", width: 279, height: 300 },
  "korume-shock": { file: "shock.png", width: 281, height: 262 },
  "korume-peek": { file: "cuoi-bi-hiem.png", width: 344, height: 300 },
  "korume-furious": { file: "tuc-gian.png", width: 257, height: 255 },
};
