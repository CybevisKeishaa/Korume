import { Container } from "@/components/ui/container";
import { ReadingDetail } from "@/components/reading/reading-detail";

export const metadata = { title: "Reading" };

export default function ReadingDetailPage({ params }: { params: { id: string } }) {
  return (
    <Container className="py-10">
      <ReadingDetail passageId={params.id} />
    </Container>
  );
}
