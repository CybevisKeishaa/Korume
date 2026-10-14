"use client";

/**
 * The learner sidebar (spec docs/superpowers/specs/2026-10-14-app-chrome-refresh-design.md). Figma 655:2 structure:
 * fixed header, independently scrolling destinations, fixed footer; expanded or rail. Holds no nav data of its own —
 * groups arrive from the registry via the server layouts.
 *
 * ⛔ Do not import `SCREEN_REGISTRY` or `NAV_GROUPS` here: this is a client module, and a module-scope import of the
 * registry ships all 78 entries to the browser — private Figma node ids, unshipped screen names,
 * `repoOnlyReason`/`figmaCheckedAt` survey observations. `lib/product/nav-groups.ts` explains it in full;
 * `deriveNavGroups` is called in the server layouts that mount this component (final whole-branch review FIX 3).
 * The type import below is erased at compile time and pulls nothing into the client graph.
 */
import Image from "next/image";
import { CircleHelp, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { useTranslations } from "@/lib/i18n";
import { NotificationBell } from "@/components/layout/notification-bell";
import { NavIcon } from "@/components/layout/nav-icons";
import { useNavSummary } from "@/components/layout/use-nav-summary";
import type { NavGroup } from "@/lib/product/nav-derivation";
import { activeKey, dueLabel, navCookieValue, readNavCookie, REVIEW_FALLBACK_HREF, REVIEW_ROUTES, type NavSummary } from "@/lib/nav/nav-state";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function AppNav({ groups, userEmail, initialSummary, mode, initialCollapsed }: {
  groups: readonly NavGroup[];
  userEmail: string;
  initialSummary: NavSummary | null;
  mode: "app" | "focus";
  initialCollapsed: boolean;
}) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const summary = useNavSummary(initialSummary);
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  // Next 14.2's router cache can replay an (app) layout rendered before the last toggle (app-footer T7): the cookie
  // is the learner's latest choice, so adopt it before paint. (focus) never reads it (spec 3.2).
  useIsoLayoutEffect(() => {
    if (mode !== "app") return;
    const stored = readNavCookie(document.cookie);
    if (stored !== null) setCollapsed(stored);
  }, [mode]);

  // Fade masks only while there is more to scroll (spec 4): top once scrolled, bottom while content remains below.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState({ top: false, bottom: false });
  const measureFade = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const top = el.scrollTop > 0;
    const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
    setFade((prev) => (prev.top === top && prev.bottom === bottom ? prev : { top, bottom }));
  }, []);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    measureFade();
    el.addEventListener("scroll", measureFade, { passive: true });
    window.addEventListener("resize", measureFade);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measureFade);
    observer?.observe(el);
    return () => {
      el.removeEventListener("scroll", measureFade);
      window.removeEventListener("resize", measureFade);
      observer?.disconnect();
    };
  }, [measureFade]);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    if (mode === "app") document.cookie = navCookieValue(next);
  };

  const listed = groups.filter((group) => group.key !== "account");
  const accountItems = groups.find((group) => group.key === "account")?.items ?? [];
  const reviewHref = summary?.reviewHref ?? REVIEW_FALLBACK_HREF;
  const current = activeKey(pathname, listed.flatMap((group) => group.items).map((item) => ({
    key: item.key, prefixes: item.key === "review" ? REVIEW_ROUTES : [item.href],
  })));
  const due = summary?.reviewDue ?? 0;

  return (
    <nav aria-label={t("ariaLabel")} className="app-nav" data-collapsed={collapsed}>
      <div className="app-nav__header">
        <Link href="/dashboard" className="app-nav__brand" aria-label={t("brand")}>
          <Image src="/korume.png" alt="" width={36} height={36} className="app-nav__logo" priority />
          {!collapsed && <span className="app-nav__wordmark" aria-hidden="true">Korume</span>}
        </Link>
        <div className="app-nav__header-actions">
          <NotificationBell />
          <button type="button" className="app-nav__icon-button" aria-expanded={!collapsed} onClick={toggle}
            aria-label={collapsed ? t("toggle.expand") : t("toggle.collapse")}>
            {collapsed ? <PanelLeftOpen aria-hidden="true" className="app-nav__icon" /> : <PanelLeftClose aria-hidden="true" className="app-nav__icon" />}
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="app-nav__scroll" data-nav-scroll data-fade-top={fade.top} data-fade-bottom={fade.bottom}>
        {listed.map((group) => (
          <div key={group.key} className="app-nav__group">
            <p id={`app-nav-group-${group.key}`} className="app-nav__group-label">{t(`groups.${group.key}`)}</p>
            <ul aria-labelledby={`app-nav-group-${group.key}`} className="app-nav__list">
              {group.items.map((item) => {
                const isReview = item.key === "review";
                // item.key is `string` once derived from the registry (R4); catalog coverage is pinned by the tests.
                const label = t(item.key as Parameters<typeof t>[0]);
                const name = isReview && due > 0 ? `${label}, ${t("reviewDue", { count: due })}` : label;
                return (
                  <li key={item.key}>
                    <Link href={isReview ? reviewHref : item.href} className="app-nav__item" aria-label={name}
                      aria-current={current === item.key ? "page" : undefined}>
                      <NavIcon navKey={item.key} />
                      <span className="app-nav__label">{label}</span>
                      {isReview && due > 0 && (collapsed
                        ? <span className="app-nav__dot" aria-hidden="true" />
                        : <span className="app-nav__badge" aria-hidden="true">{dueLabel(due)}</span>)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="app-nav__footer">
        <Link href="/help" className="app-nav__help" aria-label={t("help")}>
          <CircleHelp aria-hidden="true" className="app-nav__icon" />
          <span className="app-nav__label">{t("help")}</span>
        </Link>
        {/* account — Task 7 replaces this placeholder with <AccountMenu …/> */}
        <span data-account-slot hidden>{userEmail}{accountItems.length}</span>
      </div>
    </nav>
  );
}
