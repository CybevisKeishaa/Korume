import { Container } from "@/components/ui/container";
import { StatsDashboard } from "@/components/admin/stats-dashboard";

export const metadata = { title: "Admin — Dashboard" };

export default function AdminDashboardPage() {
  return (
    <Container className="max-w-none py-2">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="mt-1 text-muted-foreground">Users, retention and content at a glance.</p>
      <div className="mt-8">
        <StatsDashboard />
      </div>
    </Container>
  );
}
