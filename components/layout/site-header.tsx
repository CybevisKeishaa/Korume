import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <Container className="flex h-16 items-center justify-between">
        <Link href="/" className="font-jp text-lg font-bold">
          日本語シネマ
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/login"
            className={buttonStyles({ variant: "ghost", size: "sm" })}
          >
            Sign in
          </Link>
          <Link href="/register" className={buttonStyles({ size: "sm" })}>
            Start free
          </Link>
        </nav>
      </Container>
    </header>
  );
}
