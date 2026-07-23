import type { ContentFieldConfig } from "./content-fields";

/** Which `admin.content.errors.*` template applies — resolved to actual
 * translated copy by the caller (`content-form.tsx`, which has a
 * translator; this module does not — it stays a plain, i18n-free unit under
 * `content-payload.test.ts`, per the L9a "module-level English string
 * producer -> key-returning classifier resolved with t() in the render body"
 * convention). */
export type ContentPayloadErrorReason = "required" | "invalidNumber" | "invalidJson";

/** Raised by `buildContentPayload` for one bad field; carries the field name
 * so the form can attach the message to the right input (`aria-describedby`)
 * instead of a generic top-of-form error, plus a `reason` the caller
 * resolves to translated copy via `t(\`content.errors.${reason}\`, {label})`. */
export class ContentPayloadError extends Error {
  constructor(
    public readonly field: string,
    public readonly reason: ContentPayloadErrorReason,
  ) {
    // Error.message is a dev-facing fallback only (e.g. an uncaught rethrow
    // in a log) — the learner/admin-facing DOM always renders the caller's
    // translated `t(...)` copy instead, never this string directly.
    super(`content field "${field}" failed validation: ${reason}`);
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
        throw new ContentPayloadError(field.name, "invalidJson");
      }
      continue;
    }

    const known = mode === "create" || knownFields.has(field.name);

    if (raw === "") {
      if (!known) continue;
      if (field.required) throw new ContentPayloadError(field.name, "required");
      if (field.nullable) payload[field.name] = null;
      continue;
    }

    if (field.kind === "number") {
      const n = Number(raw);
      if (!Number.isFinite(n)) throw new ContentPayloadError(field.name, "invalidNumber");
      payload[field.name] = n;
      continue;
    }

    payload[field.name] = raw;
  }

  return payload;
}
