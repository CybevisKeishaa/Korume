import { notFound } from "next/navigation";
import { z } from "zod";
import { getJlptTestDetail } from "@/lib/data/jlpt";
import { Container } from "@/components/ui/container";
import { JlptTestRunner } from "@/components/jlpt/jlpt-test-runner";
import type { JlptSection } from "@/lib/jlpt-ui";

const VALID_SECTIONS = new Set<string>(["vocab", "grammar", "reading", "listening"]);

export const dynamic = "force-dynamic";

export default async function JlptTestPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { section?: string };
}) {
  if (!z.string().uuid().safeParse(params.id).success) notFound();

  const test = await getJlptTestDetail(params.id);
  if (!test) notFound();

  const requested = searchParams.section;
  const initialSection: JlptSection | undefined =
    requested && VALID_SECTIONS.has(requested) ? (requested as JlptSection) : undefined;

  return (
    <Container className="py-8">
      <JlptTestRunner test={test} initialSection={initialSection} />
    </Container>
  );
}
