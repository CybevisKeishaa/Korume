import Image from "next/image";
import { Link } from "@/lib/i18n/navigation";
import { getTranslations } from "@/lib/i18n/server";
import { getNewsletterState } from "@/lib/data/newsletter";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/app-stores";
import { AppFooterIcon } from "./app-footer-icon";
import { BackToTop } from "./back-to-top";
import { FooterNewsletter } from "./footer-newsletter";

/**
 * Figma Footer `203:13813` on the outer app pages (spec docs/superpowers/specs/2026-10-13-app-footer-design.md).
 * F1/F2: pages render this as the last element of their tree — never a layout (pin:
 * `app-footer-placement.test.ts`). L1: the frame's three sections with the owner's reallocated space; sizes live
 * in `app/globals.css` `.app-footer`. F3: a label with no destination is text; the round-3 cuts are not rendered.
 * `data-footer-reducible` marks the only content L2b may remove, in its fixed order.
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
            <p className="app-footer__tagline" data-footer-reducible="2">{t("appFooter.tagline")}</p>
            <Link href="/companion" aria-label={t("footer.mascot.cta")} className="app-footer__mascot" data-footer-reducible="3">
              <span className="app-footer__mascot-art">
                {/* F6 + plan P4: the landing footer's own trimmed art, not the frame's captioned sheet crop. */}
                <Image data-mascot src="/mascot/poses/sleeping.png" alt="" width={276} height={213} aria-hidden="true" unoptimized />
              </span>
              <span className="app-footer__word-tile">
                <span lang="ja" className="app-footer__word-tile-jp">{t("footer.wordmarkJp")}</span>
                <span className="app-footer__word-tile-en">{t("footer.wordmark")}</span>
              </span>
              <span aria-hidden="true" className="app-footer__chip">▣</span>
              <AppFooterIcon name="sparkles" className="app-footer__sparkle" />
            </Link>
          </div>

          <div className="app-footer__links">
            <nav aria-labelledby="app-footer-explore">
              <h2 id="app-footer-explore" className="app-footer__heading">{t("footer.columns.explore.heading")}</h2>
              <ul className="app-footer__list">
                <li><Link href="/dashboard" className="app-footer__link">{t("footer.columns.explore.home")}</Link></li>
                <li><Link href="/roadmap" className="app-footer__link">{t("footer.columns.explore.roadmap")}</Link></li>
              </ul>
            </nav>
            <div className="app-footer__stack">
              <nav aria-labelledby="app-footer-support">
                <h2 id="app-footer-support" className="app-footer__heading">{t("footer.columns.support.heading")}</h2>
                <ul className="app-footer__list">
                  <li>
                    <a href={`mailto:${SUPPORT_EMAIL}`} className="app-footer__link">
                      <AppFooterIcon name="mail" className="app-footer__link-icon" />
                      {t("footer.columns.explore.contact")}
                    </a>
                  </li>
                </ul>
              </nav>
              <div>
                <h2 className="app-footer__heading">{t("footer.columns.legal.heading")}</h2>
                <ul className="app-footer__list">
                  <li className="app-footer__text">{t("footer.columns.legal.privacy")}</li>
                  <li className="app-footer__text">{t("footer.columns.legal.terms")}</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="app-footer__app">
            <p className="app-footer__heading">{t("appFooter.app.eyebrow")}</p>
            <h2 className="app-footer__title">{t("appFooter.app.heading")}</h2>
            <p className="app-footer__body" data-footer-reducible="1">{t("appFooter.app.body")}</p>
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
                  <span className="app-footer__badge-prefix">{t("footer.app.playStore.prefix")}</span>
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
