/** Persisted structured answer shape; validation and rendering arrive with the turn pipeline. */
export type Run = { text: string; strong?: boolean } | { jp: string };
export type Block =
  | { type: "paragraph"; runs: Run[] }
  | { type: "example"; jp: string; ruby: { base: string; reading?: string }[]; translation: string }
  | { type: "context_card"; entityRef: string; note?: string }
  | { type: "followups"; chips: string[] };
export interface AnswerV1 { blocks: Block[] }
