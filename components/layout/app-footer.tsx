import Image from "next/image";
import { Link } from "@/lib/i18n/navigation";
import { getTranslations } from "@/lib/i18n/server";
import { getNewsletterState } from "@/lib/data/newsletter";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/app-stores";
import { AppFooterIcon } from "./app-footer-icon";
import { BackToTop } from "./back-to-top";
import { FooterNewsletter } from "./footer-newsletter";

// ponytail: every label without a page yet opens the landing page; each becomes its real href when the page exists.
const PLACEHOLDER = "/";

/**
 * Figma Footer `203:13813` on the outer app pages (spec docs/superpowers/specs/2026-10-13-app-footer-design.md).
 * F1/F2: pages render this as the last element of their tree — never a layout (pin:
 * `app-footer-placement.test.ts`). The frame's three sections and its three link columns: layout at the frame's own
 * scale (L-051), type on the app's shared tokens; sizes live in `app/globals.css` `.app-footer`. F3 (owner,
 * 2026-10-13): every frame label is rendered and is a link; one with no page of its own yet points at PLACEHOLDER.
 */
export async function AppFooter() {
  const [t, newsletter] = await Promise.all([getTranslations("marketing"), getNewsletterState()]);

  return (
    <footer data-app-footer className="app-footer">
      <div className="app-footer__inner">
        <div className="app-footer__row">
          <div className="app-footer__brand">
            <p className="app-footer__logo">
              <span aria-hidden="true" className="app-footer__logo-tile">K</span>
              <span className="app-footer__wordmark">{t("footer.wordmark")}</span>
            </p>
            <p className="app-footer__tagline">{t("appFooter.tagline")}</p>
            <Link href="/companion" aria-label={t("footer.mascot.cta")} aria-describedby="app-footer-word" className="app-footer__mascot">
              {/* Owner 2026-10-13: the card says where it goes, the tile teaches its word, the chip is the mascot's snore. */}
              <span aria-hidden="true" className="app-footer__mascot-cta">
                {t("footer.mascot.cta")}
                <AppFooterIcon name="arrowUpRight" className="app-footer__mascot-cta-icon" />
              </span>
              <span className="app-footer__mascot-art">
                {/* F6 + plan P4: the landing footer's own trimmed art, not the frame's captioned sheet crop. */}
                <Image data-mascot src="/mascot/poses/sleeping.png" alt="" width={276} height={213} aria-hidden="true" unoptimized />
              </span>
              <span id="app-footer-word" className="app-footer__word-tile">
                <span lang="ja" className="app-footer__word-tile-jp">{t("footer.wordmarkJp")}</span>
                <span className="app-footer__word-tile-en">{t("appFooter.mascot.gloss")}</span>
              </span>
              <span aria-hidden="true" className="app-footer__chip">z<span className="app-footer__chip-z">z</span></span>
              <AppFooterIcon name="sparkles" className="app-footer__sparkle" />
            </Link>
          </div>

          <div className="app-footer__links">
            <nav aria-labelledby="app-footer-explore">
              <h2 id="app-footer-explore" className="app-footer__heading">{t("footer.columns.explore.heading")}</h2>
              <ul className="app-footer__list">
                <li><Link href="/dashboard" className="app-footer__link">{t("footer.columns.explore.home")}</Link></li>
                <li><Link href={PLACEHOLDER} className="app-footer__link">{t("footer.columns.explore.pricing")}</Link></li>
                <li><Link href={PLACEHOLDER} className="app-footer__link">{t("footer.columns.explore.faq")}</Link></li>
                <li><Link href={PLACEHOLDER} className="app-footer__link">{t("footer.columns.explore.blog")}</Link></li>
                <li><Link href="/roadmap" className="app-footer__link">{t("footer.columns.explore.roadmap")}</Link></li>
                <li><Link href={PLACEHOLDER} className="app-footer__link">{t("footer.columns.explore.about")}</Link></li>
                <li><Link href={PLACEHOLDER} className="app-footer__link">{t("footer.columns.explore.careers")}</Link></li>
                <li><a href={`mailto:${SUPPORT_EMAIL}`} className="app-footer__link">{t("footer.columns.explore.contact")}</a></li>
              </ul>
            </nav>
            <div className="app-footer__stack">
              <nav aria-labelledby="app-footer-community">
                <h2 id="app-footer-community" className="app-footer__heading">{t("footer.columns.community.heading")}</h2>
                <ul className="app-footer__list">
                  {(["discord", "facebook", "tiktok"] as const).map((key) => (
                    <li key={key}>
                      <Link href={PLACEHOLDER} className="app-footer__link">
                        <AppFooterIcon name={key} className="app-footer__link-icon" />
                        {t(`footer.columns.community.${key}`)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
              <nav aria-labelledby="app-footer-support">
                <h2 id="app-footer-support" className="app-footer__heading">{t("footer.columns.support.heading")}</h2>
                <ul className="app-footer__list">
                  <li>
                    <a href={`mailto:${SUPPORT_EMAIL}`} className="app-footer__link">
                      <AppFooterIcon name="mail" className="app-footer__link-icon" />
                      {SUPPORT_EMAIL}
                    </a>
                  </li>
                </ul>
              </nav>
            </div>
            <div className="app-footer__stack">
              <nav aria-labelledby="app-footer-legal">
                <h2 id="app-footer-legal" className="app-footer__heading">{t("footer.columns.legal.heading")}</h2>
                <ul className="app-footer__list">
                  <li><Link href={PLACEHOLDER} className="app-footer__link">{t("footer.columns.legal.privacy")}</Link></li>
                  <li><Link href={PLACEHOLDER} className="app-footer__link">{t("footer.columns.legal.terms")}</Link></li>
                </ul>
              </nav>
              <div>
                <h2 className="app-footer__heading">{t("appFooter.note.heading")}</h2>
                <p className="app-footer__note">{t("appFooter.note.body")}</p>
              </div>
            </div>
          </div>

          <div className="app-footer__app">
            <p className="app-footer__heading">{t("appFooter.app.eyebrow")}</p>
            <h2 className="app-footer__title">{t("appFooter.app.heading")}</h2>
            <p className="app-footer__body">{t("appFooter.app.body")}</p>
            {/* O1 (owner 2026-10-13): Korume is not published; these open the stores' front pages, as on the landing. */}
            <div className="app-footer__badges">
              <a href={APP_STORE_URL} target="_blank" rel="noreferrer noopener" className="app-footer__badge">
                <span aria-hidden="true" className="app-footer__badge-chip">●</span>
                <span className="app-footer__badge-text">
                  <span className="app-footer__badge-prefix">{t("footer.app.appStore.prefix")}</span>
                  <span className="app-footer__badge-name">{t("footer.app.appStore.name")}</span>
                </span>
              </a>
              <a href={PLAY_STORE_URL} target="_blank" rel="noreferrer noopener" className="app-footer__badge">
                <span aria-hidden="true" className="app-footer__badge-chip app-footer__badge-chip--play">▶</span>
                <span className="app-footer__badge-text">
                  <span className="app-footer__badge-prefix app-footer__badge-prefix--caps">{t("footer.app.playStore.prefix")}</span>
                  <span className="app-footer__badge-name">{t("footer.app.playStore.name")}</span>
                </span>
              </a>
            </div>
            <hr className="app-footer__rule" />
            {newsletter ? (
              // The island re-syncs from the server value when a router.refresh() changes it (plan P2).
              <FooterNewsletter email={newsletter.email} initialOptedIn={newsletter.optedIn} />
            ) : null}
          </div>
        </div>

        <div className="app-footer__bottom">
          <p className="app-footer__closing">{t("appFooter.closing")}</p>
          <p className="app-footer__copyright">{t("footer.copyright", { year: new Date().getFullYear() })}</p>
          <BackToTop label={t("footer.backToTop")} />
        </div>
      </div>
    </footer>
  );
}
