"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "@/lib/i18n";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { AppFooterIcon } from "./app-footer-icon";

type Status = "idle" | "pending" | "subscribed" | "signedOut" | "error";

/**
 * App-footer spec N3/N3a. Saving a consent is the only claim made — never that mail will arrive (N5).
 * The request carries `{ optIn: true }` only; the server uses the session user (N3a). A confirmed save calls
 * `router.refresh()` so Settings, and this page's server props, re-read the column (plan P2).
 * Signed out (401): "Sign in" reloads, and the auth middleware sends the request to
 * `/login?redirectTo=<this page>` (plan P5).
 */
export function FooterNewsletter({ email, initialOptedIn }: { email: string; initialOptedIn: boolean }) {
  const t = useTranslations("marketing");
  const router = useRouter();
  const [status, setStatus] = useState<Status>(initialOptedIn ? "subscribed" : "idle");
  // Adjust state when the server prop changes (router.refresh, Settings): React's render-phase pattern.
  const [seenOptedIn, setSeenOptedIn] = useState(initialOptedIn);
  if (seenOptedIn !== initialOptedIn) {
    setSeenOptedIn(initialOptedIn);
    setStatus(initialOptedIn ? "subscribed" : "idle");
  }
  // Focus moves to "Manage" only on a pending -> subscribed transition, never on mount.
  const manageRef = useRef<HTMLAnchorElement>(null);
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && status === "subscribed") manageRef.current?.focus();
    wasPending.current = status === "pending";
  }, [status]);

  async function subscribe() {
    if (status === "pending") return;
    setStatus("pending");
    try {
      const response = await fetch("/api/user/newsletter", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optIn: true }),
      });
      if (response.status === 401) return setStatus("signedOut");
      if (!response.ok) return setStatus("error");
      setStatus("subscribed");
      router.refresh();
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="app-footer__newsletter">
      <p className="app-footer__newsletter-heading">{t("appFooter.newsletter.heading")}</p>
      {/* Always mounted, so a screen reader announces the text appearing (spec §5). */}
      <p role="status" className="app-footer__newsletter-done">
        {status === "subscribed" ? (
          <>
            {t("appFooter.newsletter.subscribed")}{" "}
            <Link ref={manageRef} href="/settings#newsletter" className="app-footer__link">{t("appFooter.newsletter.manage")}</Link>
          </>
        ) : null}
      </p>
      {status === "subscribed" ? null : (
        <>
          <p className="app-footer__purpose">{t("appFooter.newsletter.purpose")}</p>
          <div className="app-footer__field">
            <div className="app-footer__pill">
              <span className="app-footer__pill-label">{t("appFooter.newsletter.emailLabel")}</span>
              <span data-footer-email title={email} className="app-footer__email">{email}</span>
            </div>
            <button
              type="button"
              onClick={subscribe}
              disabled={status === "pending"}
              aria-busy={status === "pending"}
              aria-label={t("appFooter.newsletter.submit")}
              className="app-footer__send"
            >
              <AppFooterIcon name="send" className="app-footer__send-icon" />
            </button>
          </div>
          {status === "signedOut" ? (
            <p role="alert" className="app-footer__message">
              {t("appFooter.newsletter.signedOut")}{" "}
              <button type="button" className="app-footer__link" onClick={() => window.location.reload()}>
                {t("appFooter.newsletter.signIn")}
              </button>
            </p>
          ) : null}
          {status === "error" ? (
            <p role="alert" className="app-footer__message">{t("appFooter.newsletter.error")}</p>
          ) : null}
        </>
      )}
    </div>
  );
}
