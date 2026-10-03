import { z } from "zod";

const span = z.object({ start: z.number().int().min(0), end: z.number().int().min(1) }).strict()
  .refine((s) => s.start < s.end, "start must be before end");

/**
 * The client names a draft thread id and, optionally, the sentence it came from — never a route, an owner or a
 * title (spec §4.1–§4.2). A span needs a line; a line needs its video. Unknown fields are a 400.
 */
export const createThreadSchema = z.object({
  threadId: z.string().uuid(),
  videoId: z.string().uuid().optional(),
  lineId: z.string().uuid().optional(),
  span: span.optional(),
}).strict()
  .refine((b) => b.span === undefined || b.lineId !== undefined, "span needs a line")
  .refine((b) => (b.lineId === undefined) === (b.videoId === undefined), "a line needs its video");

export type CreateThreadBody = z.infer<typeof createThreadSchema>;

/** One learner question. The server owns everything else about the turn (spec §4.4). */
export const postTurnSchema = z.object({
  turnId: z.string().uuid(),
  text: z.string().trim().min(1).max(2000),
  /** The language Korume explains in. An API route cannot read the next-intl locale, so the client names it. */
  locale: z.enum(["vi", "en"]),
}).strict();

export type PostTurnBody = z.infer<typeof postTurnSchema>;
