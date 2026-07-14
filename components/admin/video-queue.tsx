"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "./confirm-dialog";
import { Dialog } from "./dialog";
import { Textarea } from "./textarea";
import type { ApiErrorBody, PendingVideoListItem, PendingVideosPage } from "@/lib/admin-ui-types";

const LIST_URL = "/api/admin/videos/pending";

type LoadState = { status: "idle" | "loading" } | { status: "error"; message: string };
type TranscriptFormat = "srt" | "vtt" | "plain";

interface RejectDialogState {
  id: string;
  reason: string;
  busy: boolean;
  error: string | null;
}

interface TranscriptDialogState {
  id: string;
  format: TranscriptFormat;
  content: string;
  busy: boolean;
  error: string | null;
}

function formatDuration(seconds: number | null): string | null {
  if (seconds === null) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as ApiErrorBody;
    return body.error || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Pending-video moderation queue (`/admin/videos`). Consumes the
 * `backend-engineer`-owned routes documented in `lib/data/admin-videos.ts`.
 * Reject is a HARD DELETE server-side (that table has no `'rejected'`
 * status) — the confirm dialog says so explicitly per this task's brief.
 */
export function VideoQueue() {
  const [items, setItems] = useState<PendingVideoListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<LoadState>({ status: "idle" });
  const [loadingMore, setLoadingMore] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [rejectDialog, setRejectDialog] = useState<RejectDialogState | null>(null);
  const [transcriptDialog, setTranscriptDialog] = useState<TranscriptDialogState | null>(null);
  const cooldownTimer = useRef<ReturnType<typeof setTimeout>>();

  const load = useCallback(async (cursor?: string) => {
    if (cursor) setLoadingMore(true);
    else setLoadState({ status: "loading" });

    try {
      const url = cursor ? `${LIST_URL}?cursor=${encodeURIComponent(cursor)}` : LIST_URL;
      const res = await fetch(url);
      if (!res.ok) {
        setLoadState({ status: "error", message: "Could not load the video queue." });
        return;
      }
      const body = (await res.json()) as { data: PendingVideosPage };
      setItems((prev) => (cursor ? [...prev, ...body.data.items] : body.data.items));
      setNextCursor(body.data.nextCursor);
      setLoadState({ status: "idle" });
    } catch {
      setLoadState({ status: "error", message: "Could not load the video queue." });
    } finally {
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => () => clearTimeout(cooldownTimer.current), []);

  function startCooldown(retryAfterSeconds: number): void {
    setRateLimited(true);
    clearTimeout(cooldownTimer.current);
    cooldownTimer.current = setTimeout(() => setRateLimited(false), retryAfterSeconds * 1000);
  }

  function handleRateLimited(res: Response): boolean {
    if (res.status !== 429) return false;
    const retryAfter = Number(res.headers.get("Retry-After") ?? "60");
    startCooldown(Number.isFinite(retryAfter) ? retryAfter : 60);
    return true;
  }

  async function approve(id: string): Promise<void> {
    setRowError(null);
    setApprovingId(id);
    try {
      const res = await fetch(`/api/admin/videos/${id}/approve`, { method: "POST" });
      if (handleRateLimited(res)) return;
      if (!res.ok) {
        setRowError({ id, message: await readErrorMessage(res, "Could not approve this video.") });
        return;
      }
      setItems((prev) => prev.filter((v) => v.id !== id));
    } catch {
      setRowError({ id, message: "Could not approve this video." });
    } finally {
      setApprovingId(null);
    }
  }

  function openReject(id: string): void {
    setRejectDialog({ id, reason: "", busy: false, error: null });
  }

  async function confirmReject(): Promise<void> {
    if (!rejectDialog) return;
    setRejectDialog({ ...rejectDialog, busy: true, error: null });
    try {
      const trimmedReason = rejectDialog.reason.trim();
      const res = await fetch(`/api/admin/videos/${rejectDialog.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(trimmedReason ? { reason: trimmedReason } : {}),
      });
      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("Retry-After") ?? "60");
        startCooldown(Number.isFinite(retryAfter) ? retryAfter : 60);
        setRejectDialog(null);
        return;
      }
      if (!res.ok) {
        setRejectDialog({
          ...rejectDialog,
          busy: false,
          error: await readErrorMessage(res, "Could not reject this video."),
        });
        return;
      }
      setItems((prev) => prev.filter((v) => v.id !== rejectDialog.id));
      setRejectDialog(null);
    } catch {
      setRejectDialog({ ...rejectDialog, busy: false, error: "Could not reject this video." });
    }
  }

  function openTranscript(id: string): void {
    setTranscriptDialog({ id, format: "srt", content: "", busy: false, error: null });
  }

  async function submitTranscript(): Promise<void> {
    if (!transcriptDialog) return;
    setTranscriptDialog({ ...transcriptDialog, busy: true, error: null });
    try {
      const res = await fetch(`/api/admin/videos/${transcriptDialog.id}/transcript`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: transcriptDialog.format, content: transcriptDialog.content }),
      });
      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("Retry-After") ?? "60");
        startCooldown(Number.isFinite(retryAfter) ? retryAfter : 60);
        setTranscriptDialog(null);
        return;
      }
      if (!res.ok) {
        setTranscriptDialog({
          ...transcriptDialog,
          busy: false,
          error: await readErrorMessage(res, "Could not save this transcript."),
        });
        return;
      }
      const body = (await res.json()) as { data: { transcriptId: string; lineCount: number } };
      const id = transcriptDialog.id;
      setItems((prev) =>
        prev.map((v) => (v.id === id ? { ...v, hasTranscript: true, transcriptLineCount: body.data.lineCount } : v)),
      );
      setTranscriptDialog(null);
    } catch {
      setTranscriptDialog({ ...transcriptDialog, busy: false, error: "Could not save this transcript." });
    }
  }

  if (loadState.status === "error") {
    return (
      <p role="alert" className="rounded-md border border-danger/40 bg-danger/5 p-4 text-sm text-danger">
        {loadState.message}
      </p>
    );
  }

  if (loadState.status === "loading" && items.length === 0) {
    return <p className="text-sm text-muted-foreground">Loading the video queue…</p>;
  }

  return (
    <div>
      {rateLimited && (
        <p role="status" className="mb-3 text-sm text-muted-foreground">
          Please wait a moment before submitting more moderation actions.
        </p>
      )}

      {items.length === 0 ? (
        <p className="rounded-md border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          No videos are waiting for review right now.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((v) => {
            const duration = formatDuration(v.duration_seconds);
            return (
              <li key={v.id} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row">
                <div className="h-24 w-40 shrink-0 overflow-hidden rounded-md bg-muted">
                  {v.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- admin CMS thumbnail from an arbitrary YouTube URL, not a local/optimized asset.
                    <img src={v.thumbnail_url} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>

                <div className="flex-1">
                  <h3 className="font-semibold">{v.title}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {v.importerName ? `Submitted by ${v.importerName}` : "Submitted by an unknown user"}
                    {duration ? ` · ${duration}` : ""}
                    {v.jlpt_level_estimate ? ` · Est. ${v.jlpt_level_estimate}` : ""}
                  </p>
                  <p className="mt-1 text-xs">
                    {v.hasTranscript ? (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                        Transcript: {v.transcriptLineCount} lines
                      </span>
                    ) : (
                      <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground">
                        No transcript
                      </span>
                    )}
                  </p>

                  {rowError?.id === v.id && (
                    <p role="alert" className="mt-2 text-xs text-danger">
                      {rowError.message}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void approve(v.id)}
                      disabled={approvingId === v.id || rateLimited}
                    >
                      {approvingId === v.id ? "Approving…" : "Approve"}
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => openTranscript(v.id)}>
                      Attach transcript
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-danger text-danger hover:bg-danger/10"
                      onClick={() => openReject(v.id)}
                      disabled={rateLimited}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {nextCursor && (
        <div className="mt-4 flex justify-center">
          <Button type="button" variant="outline" onClick={() => void load(nextCursor)} disabled={loadingMore}>
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={rejectDialog !== null}
        title="Reject video"
        description="The video will be permanently removed, along with its transcript and any progress users have made on it. This cannot be undone."
        confirmLabel="Reject"
        destructive
        busy={rejectDialog?.busy}
        error={rejectDialog?.error}
        onConfirm={() => void confirmReject()}
        onCancel={() => setRejectDialog(null)}
      >
        {rejectDialog && (
          <div className="mt-3">
            <Label htmlFor="reject-reason">Reason (optional)</Label>
            <Textarea
              id="reject-reason"
              className="mt-1"
              value={rejectDialog.reason}
              onChange={(e) => setRejectDialog({ ...rejectDialog, reason: e.target.value })}
              placeholder="Not persisted publicly — logged for moderators only."
            />
          </div>
        )}
      </ConfirmDialog>

      {transcriptDialog && (
        <Dialog open title="Attach transcript" onClose={() => setTranscriptDialog(null)}>
          <div className="space-y-3">
            <div>
              <Label htmlFor="transcript-format">Format</Label>
              <select
                id="transcript-format"
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                value={transcriptDialog.format}
                onChange={(e) =>
                  setTranscriptDialog({ ...transcriptDialog, format: e.target.value as TranscriptFormat })
                }
              >
                <option value="srt">SRT</option>
                <option value="vtt">VTT</option>
                <option value="plain">Plain text</option>
              </select>
            </div>
            <div>
              <Label htmlFor="transcript-content">Content</Label>
              <Textarea
                id="transcript-content"
                className="mt-1 min-h-[10rem] font-mono text-xs"
                value={transcriptDialog.content}
                onChange={(e) => setTranscriptDialog({ ...transcriptDialog, content: e.target.value })}
              />
            </div>
            {transcriptDialog.error && (
              <p role="alert" className="text-sm text-danger">
                {transcriptDialog.error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setTranscriptDialog(null)} disabled={transcriptDialog.busy}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void submitTranscript()}
                disabled={transcriptDialog.busy || transcriptDialog.content.trim().length === 0}
              >
                {transcriptDialog.busy ? "Saving…" : "Save transcript"}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
