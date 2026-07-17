import { Container } from "@/components/ui/container";
import { ContentTypeCards } from "@/components/admin/content-type-cards";

export const metadata = { title: "Admin — Content" };

export default function AdminContentLandingPage() {
  return (
    <Container className="max-w-none py-2">
      <h1 className="text-2xl font-bold">Content</h1>
      <p className="mt-1 text-muted-foreground">Pick a content type to manage.</p>
      <div className="mt-8">
        <ContentTypeCards />
      </div>
    </Container>
  );
}
