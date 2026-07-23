import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/container";
import { ContentManager } from "@/components/admin/content-manager";
import { contentTypeLabel } from "@/components/admin/content-fields";
import { contentTypeSchema } from "@/lib/admin-ui-types";
import { useTranslations, type Locale } from "@/lib/i18n";
import { getTranslations } from "@/lib/i18n/server";

// The locale is threaded in explicitly (spec §7 risk 2). An unknown `type`
// falls back to the plain "Admin — Content" tab rather than 404-ing the tab
// title; the page body below still calls `notFound()` for that case.
export async function generateMetadata({
  params,
}: {
  params: { locale: Locale; type: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "admin" });
  const parsed = contentTypeSchema.safeParse(params.type);
  return {
    title: parsed.success
      ? t("meta.contentType", { label: contentTypeLabel(t, parsed.data) })
      : t("meta.content"),
  };
}

export default function AdminContentTypePage({ params }: { params: { type: string } }) {
  const t = useTranslations("admin");
  const parsed = contentTypeSchema.safeParse(params.type);
  if (!parsed.success) notFound();

  const type = parsed.data;

  return (
    <Container className="max-w-none py-2">
      <h1 className="text-2xl font-bold">{contentTypeLabel(t, type)}</h1>
      <div className="mt-6">
        <ContentManager type={type} />
      </div>
    </Container>
  );
}
