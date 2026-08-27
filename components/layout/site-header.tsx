import { Link } from "@/lib/i18n/navigation";
import { getTranslations } from "@/lib/i18n/server";
import { buttonStyles } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

/**
 * §0 of the landing page (spec §2.1, §2.2).
 *
 * ⚠️ This is a MARKETING nav. It is not `NAV_GROUPS` and must not be derived
 * from the screen registry's nav fields — the registry describes the
 * authenticated IA, this describes a sales page.
 *
 * All six destinations are protected routes. A signed-out visitor is sent
 * through login and returned by the existing middleware; no new redirect
 * behaviour is introduced here.
 */
const NAV_ITEMS = [
  { key: "explore", href: "/shadowing/explore" },
  { key: "shadowing", href: "/shadowing" },
  { key: "kanji", href: "/kanji" },
  { key: "grammar", href: "/grammar" },
  { key: "practice", href: "/review" },
  { key: "companion", href: "/companion" },
] as const;

export async function SiteHeader() {
  const t = await getTranslations("marketing");

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-md">
        <Link href="/" className="font-display text-heading font-bold">
          {t("nav.wordmark")}
        </Link>
        <nav aria-label={t("nav.ariaLabel")} className="hidden items-center gap-lg md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.key}
              data-nav-item
              href={item.href}
              className="text-body text-muted-foreground transition-colors hover:text-foreground"
            >
              {t(`nav.${item.key}`)}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-xs">
          <Link href="/login" className={buttonStyles({ variant: "ghost", size: "sm" })}>
            {t("nav.signIn")}
          </Link>
          <Link href="/register" className={buttonStyles({ size: "sm" })}>
            {t("nav.cta")}
          </Link>
        </div>
      </Container>
    </header>
  );
}
