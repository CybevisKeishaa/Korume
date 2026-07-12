import { Container } from "@/components/ui/container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Placeholder for a module that lands in a later build layer. */
export function ComingSoon({ title, layer }: { title: string; layer: string }) {
  return (
    <Container className="py-12">
      <h1 className="text-2xl font-bold">{title}</h1>
      <Card className="mt-6 max-w-md">
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground">
          This module is built in {layer}. The app shell, auth and data layer are
          ready for it.
        </CardContent>
      </Card>
    </Container>
  );
}
