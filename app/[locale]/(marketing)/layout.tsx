import { Link } from "@/lib/i18n/navigation";
import { SiteHeader } from "@/components/layout/site-header";
import { SmoothScroll } from "@/components/motion/smooth-scroll";
import { Container } from "@/components/ui/container";
import { getTranslations } from "@/lib/i18n/server";

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations("marketing");
  const tCommon = await getTranslations("common");
  return (
    <SmoothScroll>
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <div className="flex-1">{children}</div>
      <footer className="border-t border-border py-8 text-sm text-muted-foreground">
        <Container className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p>{t("footer.copyright", { year: new Date().getFullYear() })}</p>
          <nav aria-label={t("footer.ariaLabel")} className="flex gap-4">
            <Link href="/login" className="hover:text-foreground">
              {tCommon("auth.signIn")}
            </Link>
            <Link href="/register" className="hover:text-foreground">
              {t("footer.cta")}
            </Link>
          </nav>
        </Container>
      </footer>
      </div>
    </SmoothScroll>
  );
}
