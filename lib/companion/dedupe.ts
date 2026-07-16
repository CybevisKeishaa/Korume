import type { MemoryType, RelationshipPhase } from "./types";

export interface MemoryRef {
  lineId?: string;
  cardId?: string;
  videoId?: string;
  jlptLevel?: string;
  phase?: RelationshipPhase;
}

function need<T>(value: T | undefined, type: MemoryType, field: string): T {
  if (value === undefined || value === null || value === "") {
    throw new TypeError(`dedupeKeyFor(${type}): missing required ref "${field}"`);
  }
  return value;
}

/** Natural idempotency key for `companion_memories.dedupe_key` (§4.3). */
export function dedupeKeyFor(type: MemoryType, ref: MemoryRef = {}): string {
  switch (type) {
    case "first_shadow":
      return "first_shadow";
    case "companion_grew":
      return `companion_grew:${need(ref.phase, type, "phase")}`;
    case "line_mastered":
      return `line_mastered:${need(ref.lineId, type, "lineId")}`;
    case "mining_saved":
      return `mining_saved:${need(ref.cardId, type, "cardId")}`;
    case "first_video_completed":
      return `first_video_completed:${need(ref.videoId, type, "videoId")}`;
    case "jlpt_passed":
      return `jlpt_passed:${need(ref.jlptLevel, type, "jlptLevel")}`;
    case "pinned_line":
      return `pinned_line:${need(ref.lineId, type, "lineId")}`;
  }
}

/** Template title (spec §4.4) — NEVER AI-generated. Gifted pins return null;
 * the learner supplies their own title. Copy is intentionally VN-first but
 * these strings move to the i18n layer in Plan 3 (L9a) — keep them here for
 * now so Plan 1 has no L9a dependency. */
export function titleFor(type: MemoryType, ref: MemoryRef = {}): string | null {
  switch (type) {
    case "first_shadow":
      return "Câu thoại đầu tiên bạn shadowing thành công.";
    case "line_mastered":
      return "Câu bạn luyện mãi rồi cuối cùng cũng nói được.";
    case "mining_saved":
      return "Câu bạn quyết định lưu lại.";
    case "first_video_completed":
      return "Video đầu tiên bạn hoàn thành.";
    case "jlpt_passed":
      return `Cột mốc JLPT ${ref.jlptLevel ?? ""}`.trim();
    case "companion_grew":
      return `Ngày người bạn đồng hành của bạn bước sang giai đoạn ${ref.phase ?? ""}`.trim();
    case "pinned_line":
      return null;
  }
}
