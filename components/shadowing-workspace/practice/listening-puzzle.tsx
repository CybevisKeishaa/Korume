import type { ReactNode } from "react";
import { PracticeGlyph } from "./practice-glyph";

export const EYEBROW = "text-caption font-bold uppercase tracking-wide text-muted-foreground";
/** The framed box the answer tray, the typing field and the Word Bank all sit in. */
export const BOX = "rounded-lg border border-border bg-muted p-sm";
const CHECK = "inline-flex h-control-md items-center justify-center gap-xs self-center rounded-full bg-primary px-lg text-body font-bold text-primary-foreground disabled:opacity-50";

/** Eyebrow + status on the left, the Hint pill (when still allowed) on the right. */
export function PuzzleHeader({ eyebrow, status, hint }: { eyebrow: string; status?: string; hint: ReactNode }) {
  return <div data-puzzle-header className="flex items-start justify-between gap-sm">
    <div className="flex flex-col gap-2xs">
      <p className={EYEBROW}>{eyebrow}</p>
      {status && <p className="text-caption text-muted-foreground">{status}</p>}
    </div>
    {hint}
  </div>;
}

/** The one Check CTA, shared by Word Bank and Typing. */
export function CheckButton({ label, disabled, onClick }: { label: string; disabled: boolean; onClick(): void }) {
  return <button type="button" disabled={disabled} onClick={onClick} className={CHECK}>{label}<PracticeGlyph name="listening-check-answer" /></button>;
}
