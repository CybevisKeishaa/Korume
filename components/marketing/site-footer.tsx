import Image from "next/image";
import { Link } from "@/lib/i18n/navigation";
import { getTranslations } from "@/lib/i18n/server";
import { Container } from "@/components/ui/container";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/app-stores";
import type { Translator } from "./translator";

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

/**
 * The frame's mascot card (`347:7087`), built after the user overturned the
 * ruling that had left it out (2026-08-28).
 *
 * The frame names its image `KorumeSleepingPeacefullyOnABook` (`347:7101`) and
 * §9 immediately above reads "The day can end softly", so the pose is the
 * sleeping one rather than the farewell a footer would otherwise suggest —
 * see `scripts/mascot/poses.json`.
 *
 * The card carries no copy of its own. Its two labels are `footer.wordmarkJp`
 * ("ことば") and `footer.wordmark`, which the frame places here rather than in
 * the brand column above; the only new string is the accessible name, because
 * the frame's `ButtonSayHelloToKorume` (`347:7100`) has no visible label and an
 * image-only link must still be nameable.
 *
 * It links to `/companion`, the product's own Companion screen — a real
 * destination (spec §2.3). That route is behind auth, so a signed-out visitor
 * lands on sign-in, which is the normal guard behaviour and not a dead end.
 */
function MascotCard({ t }: { t: Translator }) {
  return (
    <Link
      href="/companion"
      aria-label={t("footer.mascot.cta")}
      className="mt-lg flex items-center gap-sm rounded-lg border border-border bg-muted p-md transition-colors hover:border-primary/40"
    >
      <Image
        data-mascot
        src="/mascot/poses/resting.png"
        alt=""
        width={112}
        height={71}
        aria-hidden="true"
        className="shrink-0"
        // A fixed local decorative asset needs no on-demand resize or format
        // negotiation; serve the file as-is.
        unoptimized
      />
      <span>
        <span className="block font-jp text-caption text-muted-foreground">
          {t("footer.wordmarkJp")}
        </span>
        <span className="block text-caption uppercase tracking-widest text-primary-strong">
          {t("footer.wordmark")}
        </span>
      </span>
    </Link>
  );
}

function StoreBadge({ children, href }: { children: React.ReactNode; href: string }) {
  return (
    <a
      data-store-badge
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="rounded-md border border-border px-md py-sm text-caption text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
    >
      {children}
    </a>
  );
}

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
          <p className="mt-xs text-body text-muted-foreground">{t("footer.tagline")}</p>
          <MascotCard t={t} />
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
        {/*
         * These shipped as inert text while no app existed on either store.
         * The user ruled otherwise on 2026-08-28, with the fact that Korume is
         * not published stated: both badges point at the store's own front
         * page. `lib/app-stores.ts` holds the two URLs and carries the ruling.
         * External destinations, so a plain anchor rather than the locale-aware
         * `Link` — there is no locale to prefix.
         */}
        <div className="mt-md flex flex-wrap gap-sm">
          <StoreBadge href={APP_STORE_URL}>
            {t("footer.app.appStore.prefix")} {t("footer.app.appStore.name")}
          </StoreBadge>
          <StoreBadge href={PLAY_STORE_URL}>
            {t("footer.app.playStore.prefix")} {t("footer.app.playStore.name")}
          </StoreBadge>
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
