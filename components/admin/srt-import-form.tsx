"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslations } from "@/lib/i18n";
import { readErrorMessage } from "./video-queue";

type Status = { kind: "idle" | "busy" } | { kind: "done" | "error"; message: string };

const FILE_INPUT =
  "mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-card file:px-3 file:py-1.5 file:text-sm";

/**
 * Builds a lesson from subtitle files the admin already has (`importVideoFromSrt`):
 * no YouTube caption request, so it works while YouTube rate-limits caption
 * fetches. The Vietnamese file is optional and aligned onto the Japanese lines by time.
 */
export function SrtImportForm() {
  const t = useTranslations("admin");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [libraryAccess, setLibraryAccess] = useState<"FREE" | "PLUS">("FREE");
  const [japanese, setJapanese] = useState<File | null>(null);
  const [vietnamese, setVietnamese] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!japanese) return;
    const form = event.currentTarget;
    setStatus({ kind: "busy" });
    try {
      const res = await fetch("/api/admin/videos/import-srt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          youtubeUrl,
          libraryAccess,
          // Both files are read in the Japanese file's format.
          format: japanese.name.toLowerCase().endsWith(".vtt") ? "vtt" : "srt",
          content: await japanese.text(),
          ...(vietnamese ? { translation: await vietnamese.text() } : {}),
        }),
      });
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
      form.reset();
      setYoutubeUrl("");
      setJapanese(null);
      setVietnamese(null);
    } catch {
      setStatus({ kind: "error", message: t("videos.srtImport.error") });
    }
  }

  const busy = status.kind === "busy";
  return (
    <section aria-labelledby="srt-import-heading" className="rounded-lg border border-border bg-card p-4">
      <h2 id="srt-import-heading" className="text-lg font-semibold">{t("videos.srtImport.heading")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("videos.srtImport.description")}</p>
      <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={(event) => void submit(event)}>
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
            type="file"
            accept=".srt,.vtt"
            // Not `required`: the submit button already waits for this file.
            aria-required="true"
            className={FILE_INPUT}
            onChange={(event) => setJapanese(event.target.files?.[0] ?? null)}
          />
        </div>
        <div>
          <Label htmlFor="srt-import-vi">{t("videos.srtImport.vietnameseLabel")}</Label>
          <input
            id="srt-import-vi"
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
          <Button type="submit" disabled={busy || !japanese || youtubeUrl.trim().length === 0}>
            {busy ? t("videos.srtImport.importing") : t("videos.srtImport.submit")}
          </Button>
        </div>
      </form>
      <p className="mt-2 text-sm text-muted-foreground">{t("videos.srtImport.replaceNote")}</p>
      {/* Always mounted, so the result is announced when it arrives. */}
      <p role="status" className="mt-3 text-sm">{status.kind === "done" ? status.message : ""}</p>
      {status.kind === "error" && <p role="alert" className="mt-3 text-sm text-danger-strong">{status.message}</p>}
    </section>
  );
}
