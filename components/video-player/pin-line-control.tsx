"use client";

import { useId, useState } from "react";
import { useTranslations } from "@/lib/i18n";
import { Dialog } from "@/components/ui/dialog";
import { useCompanion } from "@/components/companion/use-companion";
import type { TranscriptLineRow } from "@/lib/video-types";

export interface PinLineControlProps {
  line: TranscriptLineRow;
}

type Status = "idle" | "submitting" | "success" | "alreadyKept" | "error" | "tooMany" | "signedOut";

/**
 * Which failure copy a non-ok response earns. A 401 is called out because its
 * recovery path is different in kind: an expired session is fixed by logging
 * in again, not by retrying the same request, and "network error" would send
 * the learner down the wrong road. Every other status stays generic — the
 * server's own diagnostic is never surfaced (convention #4).
 */
function statusForResponse(httpStatus: number): Status {
  if (httpStatus === 401) return "signedOut";
  if (httpStatus === 429) return "tooMany";
  return "error";
}

/**
 * Gifted pin (spec D6): the learner keeps a line in their own journal.
 * Ordinary learner UI — translated feedback allowed; the Companion itself
 * stays dormant on learning surfaces (§5.4), so this file imports the
 * `useCompanion` API (to report the new memory) and never an anchor.
 */
export function PinLineControl({ line }: PinLineControlProps) {
  const t = useTranslations("companion");
  const tCommon = useTranslations("common");
  const companion = useCompanion();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const noteId = useId();

  async function submit(): Promise<void> {
    setStatus("submitting");
    try {
      const res = await fetch("/api/companion/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcriptLineId: line.id,
          ...(note.trim() ? { note: note.trim() } : {}),
        }),
      });
      if (res.ok) {
        // A duplicate pin (line already kept) never actually saves a new
        // note — memories are immutable — so it earns its own status rather
        // than reusing "success" and letting the learner believe otherwise.
        const body = (await res.json()) as { duplicate?: boolean };
        if (body.duplicate) {
          setStatus("alreadyKept");
        } else {
          setStatus("success");
          companion.emitContext("memory_created");
        }
      } else {
        setStatus(statusForResponse(res.status));
      }
    } catch (err) {
      // Diagnostics stay in the developer console; the learner only ever sees
      // translated copy (convention #4 — never surface `body.error`).
      console.error("[companion] pin failed:", err);
      setStatus("error");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setStatus("idle");
          setOpen(true);
        }}
        aria-label={t("pin.trigger")}
        title={t("pin.trigger")}
        className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <span aria-hidden="true">✎</span>
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("pin.dialogTitle")}
        closeLabel={tCommon("actions.cancel")}
      >
        <p className="font-jp" lang="ja">
          {line.text_jp}
        </p>
        <label htmlFor={noteId} className="mt-3 block text-sm">
          {t("pin.noteLabel")}
        </label>
        <textarea
          id={noteId}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={500}
          rows={3}
          className="mt-1 w-full rounded-md border border-border bg-transparent p-2 text-sm"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md px-3 py-2 text-sm"
          >
            {tCommon("actions.cancel")}
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={status === "submitting"}
            className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:pointer-events-none disabled:opacity-50"
          >
            {tCommon("actions.save")}
          </button>
        </div>
        <p role="status" className="mt-2 min-h-5 text-sm">
          {status === "success" ? t("pin.success") : null}
          {status === "alreadyKept" ? t("pin.alreadyKept") : null}
          {status === "error" ? tCommon("errors.network") : null}
          {status === "tooMany" ? t("pin.tooMany") : null}
          {status === "signedOut" ? t("pin.signedOut") : null}
        </p>
      </Dialog>
    </>
  );
}
