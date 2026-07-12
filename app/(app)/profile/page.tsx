import { Container } from "@/components/ui/container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Profile" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <Container className="py-12">
      <h1 className="text-2xl font-bold">Profile</h1>
      <Card className="mt-6 max-w-md">
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Email:</span>{" "}
            {user?.email ?? "—"}
          </p>
          <p className="text-muted-foreground">
            Stats, avatar and learning goals arrive with the dashboard modules.
          </p>
        </CardContent>
      </Card>
    </Container>
  );
}
