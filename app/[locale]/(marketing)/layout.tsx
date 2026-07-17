import { Link } from "@/lib/i18n/navigation";
import { SiteHeader } from "@/components/layout/site-header";
import { SmoothScroll } from "@/components/motion/smooth-scroll";
import { Container } from "@/components/ui/container";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SmoothScroll>
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <div className="flex-1">{children}</div>
      <footer className="border-t border-border py-8 text-sm text-muted-foreground">
        <Container className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p>© {new Date().getFullYear()} Nihongo Cinema</p>
          <nav aria-label="Footer" className="flex gap-4">
            <Link href="/login" className="hover:text-foreground">
              Sign in
            </Link>
            <Link href="/register" className="hover:text-foreground">
              Get started
            </Link>
          </nav>
        </Container>
      </footer>
      </div>
    </SmoothScroll>
  );
}
