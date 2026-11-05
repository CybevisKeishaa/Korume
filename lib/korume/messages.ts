import { ANSWER_SCHEMA_VERSION, answerV1Schema, answerV2Schema, GROUNDING_SCHEMA_VERSION, groundingSchema } from "./answer";
import type { MessageRow } from "./store";
import type { KorumeMessageView } from "./types";

/**
 * One persisted message as the client sees it. Structured content is re-validated on every read: a row with an
 * unknown version or a shape that no longer parses degrades to its plain `content`, never to unvalidated JSON.
 */
export function toMessageView(m: MessageRow): KorumeMessageView {
  const assistant = m.role === "ai";
  const schema = m.contentSchemaVersion === 1 ? answerV1Schema : m.contentSchemaVersion === ANSWER_SCHEMA_VERSION ? answerV2Schema : null;
  const answer = assistant && schema ? schema.safeParse(m.contentJson) : null;
  const grounding = assistant && m.groundingSchemaVersion === GROUNDING_SCHEMA_VERSION ? groundingSchema.safeParse(m.groundingJson) : null;
  return {
    id: m.id,
    turnId: m.turnId ?? m.id,
    role: assistant ? "assistant" : "user",
    text: m.content,
    answer: answer?.success ? answer.data : null,
    grounding: grounding?.success ? grounding.data : null,
    createdAt: m.createdAt,
  };
}
