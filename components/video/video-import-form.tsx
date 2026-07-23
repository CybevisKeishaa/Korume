"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "@/lib/i18n/navigation";
import { useTranslations } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { VideoRow } from "@/lib/video-types";

type KnownErrorStatus = 400 | 401 | 422 | 429;

function isKnownErrorStatus(status: number): status is KnownErrorStatus {
  return status === 400 || status === 401 || status === 422 || status === 429;
}

/**
 * Which `videos.errors.*` catalog entry a failed POST /api/videos/import maps
 * to. A descriptor, not a resolved string, because `descriptorForStatus` is a
 * module-level function and cannot call `t()` itself — only the component
 * body (inside render) has translation context. Mirrors
 * `components/learning/vocab-examples-panel.tsx`'s `ErrorDescriptor` pattern.
 */
type ErrorDescriptor =
  | { key: "invalidUrl" }
  | { key: "sessionExpired" }
  | { key: "fetchFailed" }
  | { key: "rateLimited"; seconds: number }
  | { key: "rateLimitedGeneric" }
  | { key: "generic" };

/** Maps a POST /api/videos/import failure to a `videos.errors.*` descriptor. */
function descriptorForStatus(status: KnownErrorStatus | "unknown", retryAfterSeconds?: number): ErrorDescriptor {
  switch (status) {
    case 400:
      return { key: "invalidUrl" };
    case 401:
      return { key: "sessionExpired" };
    case 422:
      return { key: "fetchFailed" };
    case 429:
      return retryAfterSeconds ? { key: "rateLimited", seconds: retryAfterSeconds } : { key: "rateLimitedGeneric" };
    default:
      return { key: "generic" };
  }
}

/**
 * Import form for the /videos page. POSTs a YouTube URL to
 * /api/videos/import; on success refreshes the server-rendered list and
 * takes the user straight to the new video's shadowing page.
 */
export function VideoImportForm() {
  const t = useTranslations("videos");
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ErrorDescriptor | null>(null);

  function errorMessage(descriptor: ErrorDescriptor): string {
    return descriptor.key === "rateLimited"
      ? t("errors.rateLimited", { seconds: descriptor.seconds })
      : t(`errors.${descriptor.key}`);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    const trimmed = url.trim();
    if (!trimmed) {
      setError(descriptorForStatus(400));
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
        setError(descriptorForStatus(status, retryAfterSeconds));
        return;
      }

      const body = (await res.json()) as { data: VideoRow };
      setUrl("");
      router.refresh();
      router.push(`/videos/${body.data.id}/shadowing`);
    } catch {
      setError(descriptorForStatus("unknown"));
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
        <Label htmlFor="youtube-url">{t("urlLabel")}</Label>
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
        {loading ? t("importing") : t("import")}
      </Button>
      {error && (
        <p
          id="youtube-url-error"
          role="alert"
          className="text-sm text-danger-strong sm:basis-full"
        >
          {errorMessage(error)}
        </p>
      )}
    </form>
  );
}
