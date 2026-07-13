import { Container } from "@/components/ui/container";
import { ReadingList } from "@/components/reading/reading-list";

export const metadata = { title: "Reading" };

export default function ReadingPage() {
  return (
    <Container className="py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Reading passages</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Practice Japanese reading comprehension by JLPT level, with quiz questions and
          tap-to-lookup right in the passage.
        </p>
      </div>

      <ReadingList />
    </Container>
  );
}
