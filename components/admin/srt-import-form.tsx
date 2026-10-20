"use client";

import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslations } from "@/lib/i18n";
import { ConfirmDialog } from "./confirm-dialog";
import { readErrorMessage } from "./video-queue";

type Status =
  | { kind: "idle" | "busy" }
  | { kind: "confirmReplace"; libraryAccess: string | null }
  | { kind: "done" | "error"; message: string };

const FILE_INPUT =
  "mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-card file:px-3 file:py-1.5 file:text-sm";

/**
 * Builds a lesson from subtitle files the admin already has (`importVideoFromSrt`):
 * no YouTube caption request, so it works while YouTube rate-limits caption
 * fetches. The Vietnamese file is optional and aligned onto the Japanese lines by
 * time. A video that already exists is replaced only after an explicit confirm,
 * because replacing deletes learners' notes and marks on the old lines.
 */
export function SrtImportForm() {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [libraryAccess, setLibraryAccess] = useState<"FREE" | "PLUS">("FREE");
  const [japanese, setJapanese] = useState<File | null>(null);
  const [vietnamese, setVietnamese] = useState<File | null>(null);
  const japaneseInput = useRef<HTMLInputElement>(null);
  const vietnameseInput = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function send(replace: boolean): Promise<void> {
    if (!japanese) {
      setStatus({ kind: "error", message: t("videos.srtImport.japaneseMissing") });
      return;
    }
    setStatus({ kind: "busy" });
    try {
      const res = await fetch("/api/admin/videos/import-srt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          youtubeUrl,
          libraryAccess,
          // SRT and VTT parse alike; the Japanese file names the format for both.
          format: japanese.name.toLowerCase().endsWith(".vtt") ? "vtt" : "srt",
          content: await japanese.text(),
          ...(vietnamese ? { translation: await vietnamese.text() } : {}),
          ...(replace ? { replace: true } : {}),
        }),
      });
      if (res.status === 409) {
        const body = (await res.json().catch(() => ({}))) as { libraryAccess?: string | null };
        setStatus({ kind: "confirmReplace", libraryAccess: body.libraryAccess ?? null });
        return;
      }
      if (!res.ok) {
        setStatus({
          kind: "error",
          message: res.status === 429 ? t("videos.rateLimited") : await readErrorMessage(res, t("videos.srtImport.error")),
        });
        return;
      }
      const { data } = (await res.json()) as { data: { created: boolean; lineCount: number; translatedCount: number } };
      setStatus({
        kind: "done",
        message: t(data.created ? "videos.srtImport.created" : "videos.srtImport.replaced", {
          lines: data.lineCount,
          translated: data.translatedCount,
        }),
      });
      setYoutubeUrl("");
      setJapanese(null);
      setVietnamese(null);
      // A file input cannot be cleared through React state. Clearing it in place keeps the focused button mounted.
      if (japaneseInput.current) japaneseInput.current.value = "";
      if (vietnameseInput.current) vietnameseInput.current.value = "";
    } catch {
      setStatus({ kind: "error", message: t("videos.srtImport.error") });
    }
  }

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (status.kind !== "busy") void send(false);
  }

  const busy = status.kind === "busy";
  return (
    <section aria-labelledby="srt-import-heading" className="rounded-lg border border-border bg-card p-4">
      <h2 id="srt-import-heading" className="text-lg font-semibold">{t("videos.srtImport.heading")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("videos.srtImport.description")}</p>
      <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={submit}>
        <div className="sm:col-span-2">
          <Label htmlFor="srt-import-url">{t("videos.srtImport.urlLabel")}</Label>
          <Input
            id="srt-import-url"
            className="mt-1"
            required
            value={youtubeUrl}
            onChange={(event) => setYoutubeUrl(event.target.value)}
            placeholder="https://www.youtube.com/watch?v=…"
          />
        </div>
        <div>
          <Label htmlFor="srt-import-ja">{t("videos.srtImport.japaneseLabel")}</Label>
          <input
            id="srt-import-ja"
            ref={japaneseInput}
            type="file"
            accept=".srt,.vtt"
            className={FILE_INPUT}
            onChange={(event) => setJapanese(event.target.files?.[0] ?? null)}
          />
        </div>
        <div>
          <Label htmlFor="srt-import-vi">{t("videos.srtImport.vietnameseLabel")}</Label>
          <input
            id="srt-import-vi"
            ref={vietnameseInput}
            type="file"
            accept=".srt,.vtt"
            className={FILE_INPUT}
            onChange={(event) => setVietnamese(event.target.files?.[0] ?? null)}
          />
        </div>
        <div>
          <Label htmlFor="srt-import-access">{t("videos.srtImport.accessLabel")}</Label>
          <select
            id="srt-import-access"
            className="mt-1 flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
            value={libraryAccess}
            onChange={(event) => setLibraryAccess(event.target.value as "FREE" | "PLUS")}
          >
            {/* The tier names are product names, untranslated. */}
            <option value="FREE">FREE</option>
            <option value="PLUS">PLUS</option>
          </select>
        </div>
        <div className="flex items-end">
          {/* aria-disabled, not disabled: disabling the focused button drops keyboard focus to <body>. */}
          <Button type="submit" aria-disabled={busy}>
            {busy ? t("videos.srtImport.importing") : t("videos.srtImport.submit")}
          </Button>
        </div>
      </form>
      {/* Always mounted, so the result is announced when it arrives. */}
      <p role="status" className="mt-3 text-sm">{status.kind === "done" ? status.message : ""}</p>
      {status.kind === "error" && <p role="alert" className="mt-3 text-sm text-danger-strong">{status.message}</p>}
      <ConfirmDialog
        open={status.kind === "confirmReplace"}
        title={t("videos.srtImport.replaceTitle")}
        description={
          status.kind === "confirmReplace" && status.libraryAccess
            ? `${t("videos.srtImport.replaceDescription")} ${t("videos.srtImport.currentTier", { tier: status.libraryAccess })}`
            : t("videos.srtImport.replaceDescription")
        }
        confirmLabel={t("videos.srtImport.replaceConfirm")}
        cancelLabel={tCommon("actions.cancel")}
        destructive
        onConfirm={() => void send(true)}
        onCancel={() => setStatus({ kind: "idle" })}
      />
    </section>
  );
}
