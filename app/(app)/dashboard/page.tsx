import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Dashboard" };

const MODULES = [
  { href: "/kanji", title: "Kanji", desc: "Stroke order, readings, SRS." },
  { href: "/vocab", title: "Vocabulary", desc: "Words by level + flashcard review." },
  { href: "/grammar", title: "Grammar", desc: "Patterns with examples." },
] as const;

export default function DashboardPage() {
  return (
    <Container className="py-12">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="mt-1 text-muted-foreground">Pick a module to start studying.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((m) => (
          <Link key={m.href} href={m.href} className="group">
            <Card className="h-full transition-colors group-hover:border-primary">
              <CardHeader>
                <CardTitle>{m.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {m.desc}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        Video shadowing, JLPT tests and more arrive in later layers.
      </p>
    </Container>
  );
}
