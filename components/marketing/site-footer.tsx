import { Link } from "@/lib/i18n/navigation";
import { getTranslations } from "@/lib/i18n/server";
import { Container } from "@/components/ui/container";
import { SUPPORT_EMAIL } from "@/lib/contact";

/**
 * §10 (spec §2.3, ruling 3).
 *
 * ⚠️ This is the FRAME's footer and it wins outright over the reference's. Do
 * not substitute the reference's Product/Learn/Company/Resources/Legal columns.
 *
 * ⚠️ Every label stays; only a label with a real destination is a link. A label
 * whose page does not exist yet renders as text — no `#`, no placeholder route,
 * no 404. Adding the page later is one `href`.
 *
 * The support address (`SUPPORT_EMAIL`) is deliberately imported from
 * `@/lib/contact` rather than the catalog — see that module's own doc comment
 * for why (CLAUDE.md §6, one fact one home; it also backs the account-deletion
 * email).
 *
 * The newsletter block ships as copy only (`footer.newsletter.heading`) — no
 * `<input>`, no `<form>`. `EMAIL_PROVIDER=none` and no signup route exists;
 * spec §2.3 rules an affordance with no real destination ships as text.
 */

/** Labels that have a destination today. Everything else is text. */
const LINKS = {
  home: "/",
  roadmap: "/roadmap",
} as const;

function FooterItem({ children, href }: { children: React.ReactNode; href?: string }) {
  if (!href) {
    return <li className="text-body text-muted-foreground">{children}</li>;
  }
  return (
    <li>
      <Link href={href} className="text-body text-muted-foreground transition-colors hover:text-foreground">
        {children}
      </Link>
    </li>
  );
}

export async function SiteFooter() {
  const t = await getTranslations("marketing");

  return (
    <footer aria-label={t("footer.ariaLabel")} className="border-t border-border py-xl">
      <Container className="grid gap-xl md:grid-cols-5">
        <div className="md:col-span-2">
          <p className="font-display text-heading font-bold">{t("footer.wordmark")}</p>
          <p className="mt-2xs font-jp text-caption text-muted-foreground">{t("footer.wordmarkJp")}</p>
          <p className="mt-xs text-body text-muted-foreground">{t("footer.tagline")}</p>
        </div>

        <nav aria-labelledby="footer-explore-heading">
          <h2 id="footer-explore-heading" className="text-caption uppercase tracking-widest text-foreground">
            {t("footer.columns.explore.heading")}
          </h2>
          <ul className="mt-sm space-y-2xs">
            <FooterItem href={LINKS.home}>{t("footer.columns.explore.home")}</FooterItem>
            <FooterItem>{t("footer.columns.explore.pricing")}</FooterItem>
            <FooterItem>{t("footer.columns.explore.faq")}</FooterItem>
            <FooterItem>{t("footer.columns.explore.blog")}</FooterItem>
            <FooterItem href={LINKS.roadmap}>{t("footer.columns.explore.roadmap")}</FooterItem>
            <FooterItem>{t("footer.columns.explore.about")}</FooterItem>
            <FooterItem>{t("footer.columns.explore.careers")}</FooterItem>
            <li>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-body text-muted-foreground transition-colors hover:text-foreground"
              >
                {t("footer.columns.explore.contact")}
              </a>
            </li>
          </ul>
        </nav>

        <nav aria-labelledby="footer-community-heading">
          <h2 id="footer-community-heading" className="text-caption uppercase tracking-widest text-foreground">
            {t("footer.columns.community.heading")}
          </h2>
          <ul className="mt-sm space-y-2xs">
            {/* No real URLs exist for these yet — text, per spec §2.3. */}
            <FooterItem>{t("footer.columns.community.discord")}</FooterItem>
            <FooterItem>{t("footer.columns.community.facebook")}</FooterItem>
            <FooterItem>{t("footer.columns.community.tiktok")}</FooterItem>
          </ul>
        </nav>

        <div>
          <h2 className="text-caption uppercase tracking-widest text-foreground">
            {t("footer.columns.support.heading")}
          </h2>
          <p className="mt-sm text-body text-muted-foreground">{SUPPORT_EMAIL}</p>

          <h2 className="mt-lg text-caption uppercase tracking-widest text-foreground">
            {t("footer.columns.legal.heading")}
          </h2>
          <ul className="mt-sm space-y-2xs">
            <FooterItem>{t("footer.columns.legal.privacy")}</FooterItem>
            <FooterItem>{t("footer.columns.legal.terms")}</FooterItem>
          </ul>

          {/* Legal column's second block, frame nodes 347:7222 / 347:7226 (F1). */}
          <div className="mt-lg">
            <p className="text-caption font-medium text-foreground">{t("footer.note.heading")}</p>
            <p className="mt-2xs text-caption text-muted-foreground">{t("footer.note.body")}</p>
          </div>
        </div>
      </Container>

      <Container className="mt-xl border-t border-border pt-lg">
        <p className="text-caption uppercase tracking-widest text-primary-strong">
          {t("footer.app.eyebrow")}
        </p>
        <h2 className="mt-2xs font-display text-heading font-bold">{t("footer.app.heading")}</h2>
        <p className="mt-xs max-w-xl text-body text-muted-foreground">{t("footer.app.body")}</p>
        {/* No app exists on either store yet — text, per spec §2.3. */}
        <div className="mt-md flex flex-wrap gap-sm">
          <span className="rounded-md border border-border px-md py-sm text-caption text-muted-foreground">
            {t("footer.app.appStore.prefix")} {t("footer.app.appStore.name")}
          </span>
          <span className="rounded-md border border-border px-md py-sm text-caption text-muted-foreground">
            {t("footer.app.playStore.prefix")} {t("footer.app.playStore.name")}
          </span>
        </div>
        {/* Frame nodes 347:7275 / 347:7277 — beneath the store badges, not the brand column (F5). */}
        <p className="mt-lg text-body-lg text-foreground">{t("footer.newsletter.heading")}</p>
        <p className="mt-xs text-body text-muted-foreground">{t("footer.closing")}</p>
        <div className="mt-lg flex flex-col items-start justify-between gap-sm sm:flex-row sm:items-center">
          <p className="text-caption text-muted-foreground">
            {t("footer.copyright", { year: new Date().getFullYear() })}
          </p>
          {/*
           * "Back to the beginning" reads as an in-page scroll-to-top, not a
           * navigation to another route — this is a server component, so it
           * cannot own a scroll handler, and pointing it at `href="/"` would
           * misnavigate away from any non-home marketing page instead of
           * scrolling. No real behaviour exists yet, so — same rule as the
           * newsletter block — it ships as text, not a live control.
           */}
          <p className="text-caption text-muted-foreground">{t("footer.backToTop")}</p>
        </div>
      </Container>
    </footer>
  );
}
