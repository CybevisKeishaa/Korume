"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { VideoRow } from "@/lib/video-types";

type KnownErrorStatus = 400 | 401 | 422 | 429;

function isKnownErrorStatus(status: number): status is KnownErrorStatus {
  return status === 400 || status === 401 || status === 422 || status === 429;
}

/** Maps a POST /api/videos/import failure to a user-facing message. */
function messageForStatus(status: KnownErrorStatus | "unknown", retryAfterSeconds?: number): string {
  switch (status) {
    case 400:
      return "That doesn't look like a valid YouTube URL.";
    case 401:
      return "Your session expired — please sign in again.";
    case 422:
      return "We couldn't fetch details for that video. Double-check the link and try again.";
    case 429:
      return retryAfterSeconds
        ? `Too many imports — please wait ${retryAfterSeconds}s and try again.`
        : "Too many imports — please wait a moment and try again.";
    default:
      return "Something went wrong importing that video. Please try again.";
  }
}

/**
 * Import form for the /videos page. POSTs a YouTube URL to
 * /api/videos/import; on success refreshes the server-rendered list and
 * takes the user straight to the new video's shadowing page.
 */
export function VideoImportForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    const trimmed = url.trim();
    if (!trimmed) {
      setError(messageForStatus(400));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/videos/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtubeUrl: trimmed }),
      });

      if (!res.ok) {
        const retryAfterHeader = res.headers.get("Retry-After");
        const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : undefined;
        const status = isKnownErrorStatus(res.status) ? res.status : "unknown";
        setError(messageForStatus(status, retryAfterSeconds));
        return;
      }

      const body = (await res.json()) as { data: VideoRow };
      setUrl("");
      router.refresh();
      router.push(`/videos/${body.data.id}/shadowing`);
    } catch {
      setError(messageForStatus("unknown"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      <div className="flex-1">
        <Label htmlFor="youtube-url">YouTube URL</Label>
        <Input
          id="youtube-url"
          name="youtubeUrl"
          type="url"
          inputMode="url"
          autoComplete="off"
          placeholder="https://www.youtube.com/watch?v=..."
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          disabled={loading}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? "youtube-url-error" : undefined}
          className="mt-1"
        />
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? "Importing…" : "Import video"}
      </Button>
      {error && (
        <p
          id="youtube-url-error"
          role="alert"
          className="text-sm text-danger sm:basis-full"
        >
          {error}
        </p>
      )}
    </form>
  );
}
