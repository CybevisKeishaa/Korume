import { notFound } from "next/navigation";
import { Container } from "@/components/ui/container";
import { ContentManager } from "@/components/admin/content-manager";
import { CONTENT_TYPE_LABELS, contentTypeLabel } from "@/components/admin/content-fields";
import { contentTypeSchema } from "@/lib/admin-ui-types";
import { useTranslations } from "@/lib/i18n";

// `CONTENT_TYPE_LABELS` (English-only) is intentional here — `generateMetadata`
// is a static-export-shaped function that cannot call a translator (spec §7
// plan, Task 18 owns converting this to `generateMetadata({params: {locale}})`
// + `getTranslations`). The page body below uses the translated
// `contentTypeLabel(t, type)` for its visible `<h1>` instead.
export function generateMetadata({ params }: { params: { type: string } }) {
  const parsed = contentTypeSchema.safeParse(params.type);
  return { title: parsed.success ? `Admin — ${CONTENT_TYPE_LABELS[parsed.data]}` : "Admin — Content" };
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
