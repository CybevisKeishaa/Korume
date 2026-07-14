import type { ContentFieldConfig } from "./content-fields";

/** Raised by `buildContentPayload` for one bad field; carries the field name
 * so the form can attach the message to the right input (`aria-describedby`)
 * instead of a generic top-of-form error. */
export class ContentPayloadError extends Error {
  constructor(
    public readonly field: string,
    message: string,
  ) {
    super(message);
    this.name = "ContentPayloadError";
  }
}

/**
 * Turn a form's raw string values into the JSON body sent to
 * `POST /api/admin/content/[type]` or `PATCH /api/admin/content/[type]/[id]`.
 * Pure and DOM-free so it's unit-testable on its own (see
 * `content-payload.test.ts`).
 *
 * Rules (see `content-fields.ts` doc comments for the "why"):
 * - `kind: "json"`: blank -> omitted entirely (create: no children; edit:
 *   leave existing children untouched, matching the backend's own "omit the
 *   key to leave untouched" semantics). Non-blank -> `JSON.parse`d; invalid
 *   JSON throws `ContentPayloadError`.
 * - Scalar field, blank, and (`mode === "edit"` and NOT in `knownFields`):
 *   omitted — the edit form never had a real value to show for this field
 *   (it isn't in the type's list-query columns), so leaving it blank must
 *   not silently null out data the admin never saw.
 * - Scalar field, blank, otherwise: `required` throws; `nullable` -> `null`;
 *   neither -> omitted.
 * - Scalar field, non-blank: `kind: "number"` -> parsed (throws if not
 *   finite); otherwise the trimmed string.
 */
export function buildContentPayload(
  fields: ContentFieldConfig[],
  values: Record<string, string>,
  mode: "create" | "edit",
  knownFields: ReadonlySet<string>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  for (const field of fields) {
    const raw = (values[field.name] ?? "").trim();

    if (field.kind === "json") {
      if (raw === "") continue;
      try {
        payload[field.name] = JSON.parse(raw);
      } catch {
        throw new ContentPayloadError(field.name, `${field.label} must be valid JSON.`);
      }
      continue;
    }

    const known = mode === "create" || knownFields.has(field.name);

    if (raw === "") {
      if (!known) continue;
      if (field.required) throw new ContentPayloadError(field.name, `${field.label} is required.`);
      if (field.nullable) payload[field.name] = null;
      continue;
    }

    if (field.kind === "number") {
      const n = Number(raw);
      if (!Number.isFinite(n)) throw new ContentPayloadError(field.name, `${field.label} must be a number.`);
      payload[field.name] = n;
      continue;
    }

    payload[field.name] = raw;
  }

  return payload;
}
