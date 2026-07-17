import { notFound } from "next/navigation";
import { Container } from "@/components/ui/container";
import { ContentManager } from "@/components/admin/content-manager";
import { CONTENT_TYPE_LABELS } from "@/components/admin/content-fields";
import { contentTypeSchema } from "@/lib/admin-ui-types";

export function generateMetadata({ params }: { params: { type: string } }) {
  const parsed = contentTypeSchema.safeParse(params.type);
  return { title: parsed.success ? `Admin — ${CONTENT_TYPE_LABELS[parsed.data]}` : "Admin — Content" };
}

export default function AdminContentTypePage({ params }: { params: { type: string } }) {
  const parsed = contentTypeSchema.safeParse(params.type);
  if (!parsed.success) notFound();

  const type = parsed.data;

  return (
    <Container className="max-w-none py-2">
      <h1 className="text-2xl font-bold">{CONTENT_TYPE_LABELS[type]}</h1>
      <div className="mt-6">
        <ContentManager type={type} />
      </div>
    </Container>
  );
}
