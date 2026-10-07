import { errors } from "playwright";
import { getTranslations } from "@/lib/i18n/server";
import { readJsonBody } from "@/lib/http/read-json-body";
import { rateLimit } from "@/lib/rate-limit";
import { authenticateSummary } from "@/lib/summary/load-snapshot";
import { contentDisposition, pdfFilename } from "@/lib/vocabulary/print/filename";
import { resolveLessonSource } from "@/lib/vocabulary/print/lesson-source";
import { createRenderJob } from "@/lib/vocabulary/print/pdf/jobs";
import { createQueue, QueueFullError } from "@/lib/vocabulary/print/pdf/queue";
import { PdfLayoutError, PdfUnavailableError, renderPdf } from "@/lib/vocabulary/print/pdf/renderer";
import { assignPages, pdfRequestSchema } from "@/lib/vocabulary/print/pdf/request";
import { loadPrintResources } from "@/lib/vocabulary/print/resources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIMIT = { limit: 5, windowMs: 60_000 };
const queue: ReturnType<typeof createQueue> = ((globalThis as { __korumePrintQueue?: ReturnType<typeof createQueue> }).__korumePrintQueue ??= createQueue(5));
const MAX_BODY_BYTES = 1_000_000;
const status = (code: number, headers?: Record<string, string>) => new Response(null, { status: code, headers });

/** Spec W §6.3: a real PDF of exactly the committed pages, rendered by server Chromium; nothing from the client is trusted. */
export async function POST(request: Request): Promise<Response> {
  const auth = await authenticateSummary();
  if (!auth) return status(401);
  const limited = rateLimit(`print-pdf:${auth.userId}`, LIMIT);
  if (!limited.ok) return status(429, { "Retry-After": String(Math.ceil(limited.retryAfter / 1000)) });
  const body = await readJsonBody(request, MAX_BODY_BYTES);
  if (!body.ok) return status(body.status);
  const parsed = pdfRequestSchema.safeParse(body.value);
  if (!parsed.success) return status(400);
  const { lessonId, set, locale, settings } = parsed.data;
  const source = await resolveLessonSource({ source: { kind: "lesson", lessonId, set }, locale, userId: auth.userId, db: auth.supabase });
  if (source.kind !== "ok") return status(404);
  const assigned = assignPages(source.doc, parsed.data);
  if (!assigned.ok) return status(400);
  const resources = await loadPrintResources(assigned.items.flatMap((item) => (item.target ? [item.target] : [])));
  const payload = { locale, title: source.doc.title, settings, pages: assigned.pages, resources };
  try {
    // the job is created when the task actually runs, so its 60s TTL never ticks while it waits in the queue
    const pdf = await queue.run(async () => renderPdf(`/${locale}/print-render/${createRenderJob({ userId: auth.userId, lessonId, payload })}`));
    const t = await getTranslations({ locale, namespace: "vocab.print" });
    const name = pdfFilename(settings.mode === "practice" ? t("docPractice") : t("docSelfTest"), source.doc.title);
    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: { "Content-Type": "application/pdf", "Content-Disposition": contentDisposition(name, settings.mode), "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof PdfLayoutError) return status(409);
    if (error instanceof QueueFullError) return status(503, { "Retry-After": "10" });
    if (error instanceof PdfUnavailableError) return status(503);
    if (error instanceof errors.TimeoutError) return status(504);
    throw error;
  }
}
