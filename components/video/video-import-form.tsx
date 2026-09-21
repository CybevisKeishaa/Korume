"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "@/lib/i18n/navigation";
import { useTranslations } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { LessonCreationJobProjection } from "@/lib/lesson-creation/types";
import { LessonCreationProgress } from "./lesson-creation-progress";
import { useLessonCreationJob } from "./use-lesson-creation-job";

type KnownErrorStatus = 400 | 401 | 403 | 429 | 503;

function isKnownErrorStatus(status: number): status is KnownErrorStatus {
  return status === 400 || status === 401 || status === 403 || status === 429 || status === 503;
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
  | { key: "quotaReached" }
  | { key: "unavailable" }
  | { key: "rateLimited"; seconds: number }
  | { key: "rateLimitedGeneric" }
  | { key: "generic" };

/**
 * Maps a POST /api/videos/import failure to a `videos.errors.*` descriptor.
 *
 * 422 is deliberately absent: metadata failure is no longer synchronous. The
 * endpoint accepts the request and the worker records `metadata_unavailable`,
 * which `LessonCreationProgress` states from the projection instead.
 */
function descriptorForStatus(status: KnownErrorStatus | "unknown", retryAfterSeconds?: number): ErrorDescriptor {
  switch (status) {
    case 400:
      return { key: "invalidUrl" };
    case 401:
      return { key: "sessionExpired" };
    case 403:
      return { key: "quotaReached" };
    case 503:
      return { key: "unavailable" };
    case 429:
      return retryAfterSeconds ? { key: "rateLimited", seconds: retryAfterSeconds } : { key: "rateLimitedGeneric" };
    default:
      return { key: "generic" };
  }
}

/**
 * Import form for the /shadowing page. POSTs a YouTube URL to
 * /api/videos/import, which queues durable work and answers `202` with a job
 * to poll — so this form no longer navigates on the response. It shows the
 * job's durable progress and routes to the lesson only once the job succeeds
 * and names one. A job-time failure keeps the learner here, with a retry.
 */
export interface VideoImportFormProps {
  /** The Hub uses its own labelled section and needs a compact control row. */
  variant?: "default" | "hub";
}

export function VideoImportForm({ variant = "default" }: VideoImportFormProps) {
  const t = useTranslations("videos");
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ErrorDescriptor | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const isHubForm = variant === "hub";

  const { job, events, phase, refusedStatus, restart } = useLessonCreationJob(jobId, {
    onSucceeded(succeeded: LessonCreationJobProjection) {
      router.refresh();
      // A succeeded job without a lesson id would route to /shadowing/null;
      // refresh the list and stay put instead.
      if (succeeded.lessonId !== null) router.push(`/shadowing/${succeeded.lessonId}`);
    },
  });

  /**
   * In flight, or a job still being polled. Anything that ENDS the poll must
   * end this too: a form that cannot leave "Importing…" strands the learner
   * with no way out but a page reload, while the job finishes unseen.
   */
  // `phase` is still `idle` in the render that first sets `jobId` — the hook's
  // effect has not run yet — so treating only `polling` as busy would flash an
  // enabled "Import video" between a successful enqueue and the first poll.
  const working = loading || (jobId !== null && (phase === "polling" || phase === "idle"));

  function pollingRefusal(): ErrorDescriptor | null {
    if (phase === "refused") {
      // The read was refused, not the video: a 401 means sign in again.
      return refusedStatus === 401 ? { key: "sessionExpired" } : { key: "generic" };
    }
    // A job still being polled has nothing to say here. A queued job that no live
    // worker can reach is ended server-side, on this poll's own read, and arrives
    // as an ordinary terminal failure that `LessonCreationProgress` states with a
    // retry (design §7) — there is no client-side budget to run out.
    return null;
  }

  const shownError: ErrorDescriptor | null = error ?? pollingRefusal();

  function errorMessage(descriptor: ErrorDescriptor): string {
    return descriptor.key === "rateLimited"
      ? t("errors.rateLimited", { seconds: descriptor.seconds })
      : t(`errors.${descriptor.key}`);
  }

  function refusalFrom(response: Response): ErrorDescriptor {
    const retryAfterHeader = response.headers.get("Retry-After");
    const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : undefined;
    const status = isKnownErrorStatus(response.status) ? response.status : "unknown";
    return descriptorForStatus(status, retryAfterSeconds);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (working) return;

    const trimmed = url.trim();
    if (!trimmed) {
      setError(descriptorForStatus(400));
      return;
    }

    setLoading(true);
    setError(null);
    setJobId(null);
    try {
      const res = await fetch("/api/videos/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtubeUrl: trimmed }),
      });

      if (!res.ok) {
        setError(refusalFrom(res));
        return;
      }

      const body = (await res.json()) as { data: LessonCreationJobProjection };
      setUrl("");
      setJobId(body.data.id);
    } catch {
      setError(descriptorForStatus("unknown"));
    } finally {
      setLoading(false);
    }
  }

  async function handleRetry(): Promise<void> {
    if (jobId === null) return;
    setError(null);
    try {
      const res = await fetch(`/api/lesson-creation-jobs/${jobId}/retry`, { method: "POST" });
      // 409 means the job is active again already — polling it is the honest
      // response, not an error the learner can act on.
      if (!res.ok && res.status !== 409) {
        setError(refusalFrom(res));
        return;
      }
      restart();
    } catch {
      setError(descriptorForStatus("unknown"));
    }
  }

  return (
    <div>
    <form
      onSubmit={handleSubmit}
      noValidate
      className={cn(
        "flex flex-col gap-3 sm:flex-row",
        isHubForm ? "sm:items-center" : "sm:items-end",
      )}
    >
      <div className="flex-1">
        <Label className={isHubForm ? "sr-only" : undefined} htmlFor="youtube-url">
          {t("urlLabel")}
        </Label>
        <Input
          id="youtube-url"
          name="youtubeUrl"
          type="url"
          inputMode="url"
          autoComplete="off"
          placeholder="https://www.youtube.com/watch?v=..."
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          disabled={working}
          aria-invalid={shownError ? "true" : undefined}
          aria-describedby={shownError ? "youtube-url-error" : undefined}
          className={isHubForm ? "mt-0" : "mt-1"}
        />
      </div>
      <Button className={isHubForm ? "shrink-0 whitespace-nowrap" : undefined} type="submit" disabled={working}>
        {working ? t("importing") : t("import")}
      </Button>
      {shownError && (
        <p
          id="youtube-url-error"
          role="alert"
          className="text-body text-danger-strong sm:basis-full"
        >
          {errorMessage(shownError)}
        </p>
      )}
    </form>
    {job !== null && <LessonCreationProgress job={job} events={events} onRetry={handleRetry} />}
    </div>
  );
}
