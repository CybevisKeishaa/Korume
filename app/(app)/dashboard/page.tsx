import { Container } from "@/components/ui/container";

export const metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <Container className="py-12">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="mt-2 text-muted-foreground">
        Your learning home. Modules arrive in Layer 2.
      </p>
    </Container>
  );
}
