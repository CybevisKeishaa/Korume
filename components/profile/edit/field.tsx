"use client";

import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { Select, type SelectOption } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** The id every control and its messages derive from; also how Save finds the first invalid field to focus. */
export const fieldId = (name: string) => `profile-edit-${name}`;
export const messageId = (name: string) => `${fieldId(name)}-message`;

/**
 * A labelled field with its hint and error linked through `aria-describedby`. The control is rendered by the
 * caller (it needs the id and the describedby), so this only owns the label and the messages.
 */
export function Field({
  name, label, error, hint, className, children,
}: {
  name: string; label: string; error?: string | null; hint?: ReactNode; className?: string; children: ReactNode;
}) {
  return (
    <div className={className}>
      <Label htmlFor={fieldId(name)} className="mb-2xs block text-caption text-muted-foreground">{label}</Label>
      {children}
      {(error || hint) && (
        <p id={messageId(name)} aria-live="polite" className={`mt-2xs text-caption ${error ? "text-danger-strong" : "text-muted-foreground"}`}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

/** Props that link a control to its message (error or hint) and flag it invalid only for an error. */
export const describe = (name: string, error?: string | null, hint?: unknown) => ({
  ...(error || hint ? { "aria-describedby": messageId(name) } : {}),
  ...(error ? { "aria-invalid": true as const } : {}),
});

/** Multi-line input in the same skin as `Input` (the kit has no textarea). */
export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "block min-h-control-md w-full rounded-md border border-input bg-input-background px-sm py-xs text-body",
        "placeholder:text-muted-foreground aria-[invalid=true]:border-danger",
        props.className,
      )}
    />
  );
}

const NONE = "__none__";

/** A closed list whose empty choice is stored as `""`. Radix forbids an empty item value, hence the sentinel. */
export function OptionalSelect({
  name, label, value, onChange, options, notSet, error,
}: {
  name: string; label: string; value: string; onChange: (value: string) => void; options: SelectOption[]; notSet: string; error?: string | null;
}) {
  return (
    <Select
      id={fieldId(name)}
      aria-label={label}
      value={value === "" ? NONE : value}
      onValueChange={(next) => onChange(next === NONE ? "" : next)}
      options={[{ value: NONE, label: notSet }, ...options]}
      {...describe(name, error)}
    />
  );
}
