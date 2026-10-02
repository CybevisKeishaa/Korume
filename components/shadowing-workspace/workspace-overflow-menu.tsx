"use client";

import { useId, useRef, useState } from "react";
import { SaveToPlaylistButton } from "@/components/community/save-to-playlist-button";
import { Popover } from "@/components/ui/popover";
import { useTranslations } from "@/lib/i18n";
import { toPlainText, toSrt } from "@/lib/shadowing-workspace/transcript-export";
import { HEADER_ICON_BUTTON } from "./lesson-bookmark-button";
import { MoreGlyph } from "./player-glyphs";
import { useLesson } from "./workspace-context";

/** A title as a filename: no characters Windows or macOS refuse, never empty. */
export function transcriptFilename(title: string, extension: "srt" | "txt"): string {
  // eslint-disable-next-line no-control-regex -- control characters are exactly what must go
  const base = title.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim().replace(/[. ]+$/, "");
  return `${base || "transcript"}.${extension}`;
}

export const REVOKE_DELAY_MS = 10_000;

function downloadText(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Not revoked at once: some browsers (older Firefox, Safari) start the download after click() returns.
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}

const ITEM = "w-full rounded-md px-sm py-2xs text-left text-body hover:bg-muted";

/**
 * Header `⋯` (spec §7.2): Save to playlist and Download transcript (client-side, from the loaded lines).
 * A popover with plain buttons, not `role="menu"`: Save to playlist is a disclosure holding a form, which a
 * menu may not contain. Downloads are absent without a transcript.
 */
export function WorkspaceOverflowMenu() {
  const t = useTranslations("shadowing");
  const { video, lines, transcriptId } = useLesson();
  const [open, setOpen] = useState(false);
  const downloadId = useId();
  const saveRef = useRef<HTMLDivElement>(null);
  const hasTranscript = transcriptId !== null && lines.length > 0;

  const download = (extension: "srt" | "txt") => {
    downloadText(transcriptFilename(video.title, extension), extension === "srt" ? toSrt(lines, video.durationSeconds) : toPlainText(lines));
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      align="end"
      label={t("workspace.header.more")}
      // Save to playlist's panel closes itself on Escape (a document listener). Radix listens in the capture
      // phase and would close this popover first, unmounting the panel; one Escape closes one layer.
      onEscapeKeyDown={(event) => { if (saveRef.current?.querySelector("[aria-expanded='true']")) event.preventDefault(); }}
      // As wide as Save to playlist's panel (w-64), which hangs below the popover (see the Save container).
      className="w-64 p-xs"
      trigger={(
        <button type="button" aria-label={t("workspace.header.more")} title={t("workspace.header.more")} className={HEADER_ICON_BUTTON}>
          <MoreGlyph className="size-icon-sm" />
        </button>
      )}
    >
      <div className="flex flex-col gap-xs">
        <div ref={saveRef} className="px-2xs">
          {/* `static`: its absolute panel then anchors to the popover box, opening flush beneath it instead of
              over the Download group (measured at 1280×529: it covered it and spilled 143px past the left edge). */}
          <SaveToPlaylistButton videoId={video.id} className="static block" />
        </div>
        {hasTranscript && (
          <div role="group" aria-labelledby={downloadId} className="border-t pt-xs">
            <p id={downloadId} className="px-sm pb-2xs text-caption font-semibold text-muted-foreground">{t("workspace.header.downloadTranscript")}</p>
            <button type="button" onClick={() => download("srt")} className={ITEM}>{t("workspace.header.downloadSrt")}</button>
            <button type="button" onClick={() => download("txt")} className={ITEM}>{t("workspace.header.downloadTxt")}</button>
          </div>
        )}
      </div>
    </Popover>
  );
}
