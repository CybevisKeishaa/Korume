import { Link } from "@/lib/i18n/navigation";
import { getTranslations } from "@/lib/i18n/server";
import { buttonStyles } from "@/components/ui/button";
import { MarketingContainer } from "@/components/marketing/marketing-container";
import { SiteMenu } from "./site-menu";

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

/** One home for the two auth routes: the bar renders them above `md`, the
 *  sheet renders them below it, and both read them from here. */
const SIGN_IN_HREF = "/login";
const CTA_HREF = "/register";

export async function SiteHeader() {
  const t = await getTranslations("marketing");

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      {/* `h-header` (not `h-16`): `section.tsx` reserves this same token as
          scroll margin so an anchored heading clears this sticky bar. One
          fact, one home — a hand-synced pair would drift silently, because
          nothing renders the bar and a section anchor together. */}
      <MarketingContainer className="flex h-header items-center justify-between gap-md">
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
        {/* Both move into the sheet below `md`. They are the heaviest pair in
            the bar — 184.7px (en) / 207.2px (vi) unwrapped against 288px of
            room at 320 — and keeping them would have made the reflow
            arithmetic unsolvable no matter what else was cut. */}
        <div className="hidden items-center gap-xs md:flex">
          <Link href={SIGN_IN_HREF} className={buttonStyles({ variant: "ghost", size: "sm" })}>
            {t("nav.signIn")}
          </Link>
          <Link href={CTA_HREF} className={buttonStyles({ size: "sm" })}>
            {t("nav.cta")}
          </Link>
        </div>

        <SiteMenu
          items={NAV_ITEMS.map((item) => ({
            key: item.key,
            href: item.href,
            label: t(`nav.${item.key}`),
          }))}
          labels={{
            open: t("nav.menuOpen"),
            close: t("nav.menuClose"),
            nav: t("nav.menuAriaLabel"),
            signIn: t("nav.signIn"),
            cta: t("nav.cta"),
          }}
          signInHref={SIGN_IN_HREF}
          ctaHref={CTA_HREF}
        />
      </MarketingContainer>
    </header>
  );
}
