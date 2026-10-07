import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PdfRender } from "@/components/vocabulary-print/pdf-render";
import { takeRenderJob } from "@/lib/vocabulary/print/pdf/jobs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Spec W §6.3 step 5: the server Chromium's target. No session — the single-use token is the capability. No database read. */
export default async function PrintRenderPage({ params }: { params: { locale: string; token: string } }) {
  const job = takeRenderJob(params.token);
  if (!job || job.payload.locale !== params.locale) notFound();
  return <PdfRender payload={job.payload} />;
}
