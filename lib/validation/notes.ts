import { z } from "zod";

export const SENTENCE_NOTE_MAX = 4000;
export const LESSON_NOTE_MAX = 20000;
// Request byte caps: the caps above count code points, whose worst JSON encoding is a 12-byte escaped surrogate
// pair (𠮷); 1 KiB covers the keys.
export const SENTENCE_NOTE_MAX_BYTES = 12 * SENTENCE_NOTE_MAX + 1024;
export const LESSON_NOTE_MAX_BYTES = 12 * LESSON_NOTE_MAX + 1024;

/** PostgreSQL's char_length counts code points; zod's .max() counts UTF-16 units and would refuse 𠮷-heavy notes. */
const noteBody = (max: number) => z.string().refine((body) => Array.from(body).length <= max, `at most ${max} characters`);

export const sentenceNoteKeySchema = z.object({ transcriptLineId: z.string().uuid() }).strict();

/** An empty body means "delete this note". */
export const sentenceNoteBodySchema = sentenceNoteKeySchema.extend({ body: noteBody(SENTENCE_NOTE_MAX) }).strict();

export const lessonNoteBodySchema = z.object({ body: noteBody(LESSON_NOTE_MAX) }).strict();
