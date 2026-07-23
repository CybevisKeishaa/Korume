"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "./textarea";
import { Dialog } from "./dialog";
import { buildContentPayload, ContentPayloadError } from "./content-payload";
import { CONTENT_FIELDS, contentTypeLabel, fieldLabel, type ContentFieldConfig } from "./content-fields";
import type { ContentRow, ContentType } from "@/lib/admin-ui-types";
import { useTranslations } from "@/lib/i18n";

export interface ContentFormProps {
  type: ContentType;
  mode: "create" | "edit";
  /** The row being edited (as loaded from the LIST query — see
   * `content-fields.ts`'s `CONTENT_LIST_COLUMNS` doc comment for why some
   * fields may be unknown here). Ignored when `mode === "create"`. */
  initialItem?: ContentRow;
  /** Which of `initialItem`'s columns actually came from the list query
   * (vs. being entirely absent) — used so leaving an absent field blank
   * omits it from the PATCH rather than nulling it out. */
  knownFields: ReadonlySet<string>;
  onCancel: () => void;
  /** Perform the actual create/update request; return `{ ok: true }` on
   * success or `{ ok: false, error }` to show a top-of-form error. */
  onSubmit: (payload: Record<string, unknown>) => Promise<{ ok: true } | { ok: false; error: string }>;
}

function initialValues(fields: ContentFieldConfig[], item: ContentRow | undefined): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of fields) {
    if (field.kind === "json" || !item || !(field.name in item)) {
      values[field.name] = "";
      continue;
    }
    const raw = item[field.name];
    values[field.name] = raw === null || raw === undefined ? "" : String(raw);
  }
  return values;
}

/**
 * Generic create/edit form, driven entirely by `content-fields.ts`'s
 * per-type field config. Nested child data (kanji readings, JLPT/reading
 * questions, grammar example sentences) is edited as a single JSON textarea
 * per field — pragmatic MVP choice (task brief); a repeating field-group
 * editor is a reasonable follow-up but out of scope here.
 */
export function ContentForm({ type, mode, initialItem, knownFields, onCancel, onSubmit }: ContentFormProps) {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const fields = CONTENT_FIELDS[type];
  const [values, setValues] = useState<Record<string, string>>(() => initialValues(fields, initialItem));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const formId = useId();

  function setValue(name: string, value: string): void {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setFieldErrors({});
    setFormError(null);

    let payload: Record<string, unknown>;
    try {
      payload = buildContentPayload(fields, values, mode, knownFields);
    } catch (err) {
      if (err instanceof ContentPayloadError) {
        setFieldErrors({
          [err.field]: t(`content.errors.${err.reason}`, { label: fieldLabel(t, type, err.field) }),
        });
      } else {
        setFormError(t("content.errors.validationFailed"));
      }
      return;
    }

    setBusy(true);
    const result = await onSubmit(payload);
    setBusy(false);
    if (!result.ok) setFormError(result.error);
  }

  const typeLabel = contentTypeLabel(t, type);
  const title = mode === "create" ? t("content.form.addTitle", { type: typeLabel }) : t("content.form.editTitle", { type: typeLabel });

  return (
    <Dialog open title={title} onClose={onCancel} closeLabel={tCommon("a11y.closeDialog")}>
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        {fields.map((field) => {
          const inputId = `${formId}-${field.name}`;
          return (
            <div key={field.name}>
              <Label htmlFor={inputId}>
                {fieldLabel(t, type, field.name)}
                {field.required ? " *" : ""}
              </Label>
              {field.kind === "select" ? (
                <select
                  id={inputId}
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                  value={values[field.name] ?? ""}
                  required={field.required}
                  onChange={(e) => setValue(field.name, e.target.value)}
                >
                  <option value="">{field.nullable ? t("content.form.selectNone") : t("content.form.selectPlaceholder")}</option>
                  {field.options?.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : field.kind === "textarea" || field.kind === "json" ? (
                <Textarea
                  id={inputId}
                  className={field.kind === "json" ? "mt-1 min-h-[6rem] font-mono text-xs" : "mt-1"}
                  value={values[field.name] ?? ""}
                  required={field.required}
                  onChange={(e) => setValue(field.name, e.target.value)}
                />
              ) : (
                <Input
                  id={inputId}
                  type={field.kind === "number" ? "number" : "text"}
                  className="mt-1"
                  value={values[field.name] ?? ""}
                  required={field.required}
                  onChange={(e) => setValue(field.name, e.target.value)}
                />
              )}
              {field.helpText && <p className="mt-1 text-xs text-muted-foreground">{field.helpText}</p>}
              {fieldErrors[field.name] && (
                <p role="alert" className="mt-1 text-xs text-danger-strong">
                  {fieldErrors[field.name]}
                </p>
              )}
            </div>
          );
        })}

        {formError && (
          <p role="alert" className="text-sm text-danger-strong">
            {formError}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
            {tCommon("actions.cancel")}
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? t("content.form.saving") : tCommon("actions.save")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
