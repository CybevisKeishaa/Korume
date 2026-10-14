"use client";

import { ChevronsUpDown, LogOut, Settings, User, Wind } from "lucide-react";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Link } from "@/lib/i18n/navigation";
import { useTranslations } from "@/lib/i18n";
import { useTheme } from "@/components/providers/theme-provider";
import { placeMenu, type NavSummary } from "@/lib/nav/nav-state";

const ITEM_ICONS: Record<string, typeof User> = { profile: User, settings: Settings };

/** Account trigger + menu (spec §3.5). Fixed-position in the viewport (plan P3) so the nav scroll region can
 * never clip it; keyboard: ↑/↓/Home/End, Esc returns focus, Tab and outside click close. */
export function AccountMenu({ summary, email, items, collapsed }: {
  summary: NavSummary | null; email: string; items: readonly { href: string; key: string }[]; collapsed: boolean;
}) {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  // accountReduceMotion, not reduceMotion: the checkbox must follow the person, not the OS-folded value.
  const { accountReduceMotion, setReduceMotion } = useTheme();
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [focusOn, setFocusOn] = useState<"first" | "last">("first");
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  const itemsIn = () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? []);
  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    setPosition(null);
    if (returnFocus) triggerRef.current?.focus();
  }, []);
  const openMenu = (where: "first" | "last") => { setFocusOn(where); setOpen(true); };

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !menuRef.current) return;
    const anchor = triggerRef.current.getBoundingClientRect();
    const box = menuRef.current.getBoundingClientRect();
    setPosition(placeMenu(anchor, { width: box.width, height: box.height }, { width: window.innerWidth, height: window.innerHeight }, collapsed ? "right" : "above"));
    const list = itemsIn();
    (focusOn === "first" ? list[0] : list[list.length - 1])?.focus();
  }, [open, collapsed, focusOn]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) close(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open, close]);

  const onMenuKey = (event: React.KeyboardEvent) => {
    const list = itemsIn();
    const index = list.indexOf(document.activeElement as HTMLElement);
    const go = (i: number) => { event.preventDefault(); list[(i + list.length) % list.length]?.focus(); };
    if (event.key === "ArrowDown") go(index + 1);
    else if (event.key === "ArrowUp") go(index - 1);
    else if (event.key === "Home") go(0);
    else if (event.key === "End") go(list.length - 1);
    else if (event.key === "Escape") { event.preventDefault(); close(true); }
    else if (event.key === "Tab") close(false);
  };

  const name = summary?.name ?? "";
  const initial = name.trim().charAt(0).toUpperCase() || "·";

  return (
    <>
      <button ref={triggerRef} type="button" className="app-nav__account" aria-haspopup="menu" aria-expanded={open}
        aria-controls={open ? menuId : undefined} aria-label={t("account.trigger", { name: name || t("account.menu") })}
        onClick={() => (open ? close(false) : openMenu("first"))}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") { event.preventDefault(); openMenu("first"); }
          if (event.key === "ArrowUp") { event.preventDefault(); openMenu("last"); }
        }}>
        <span className={summary?.plan === "plus" ? "app-nav__avatar app-nav__avatar--plus" : "app-nav__avatar"} aria-hidden="true">
          {summary?.avatarUrl
            // eslint-disable-next-line @next/next/no-img-element -- avatar from storage or OAuth, arbitrary origin.
            ? <img src={summary.avatarUrl} alt="" />
            : initial}
        </span>
        {!collapsed && (
          <>
            <span className="app-nav__account-text">
              <span className="app-nav__account-name" title={name}>{name}</span>
              {summary?.plan && <span className={`app-nav__plan app-nav__plan--${summary.plan}`}>{t(`plan.${summary.plan}`)}</span>}
            </span>
            <ChevronsUpDown aria-hidden="true" className="app-nav__icon app-nav__chevron" />
          </>
        )}
      </button>

      {open && (
        <div ref={menuRef} id={menuId} role="menu" aria-label={t("account.menu")} className="account-menu" onKeyDown={onMenuKey}
          style={position ? { left: position.left, top: position.top } : { left: 0, top: 0, visibility: "hidden" }}>
          <div className="account-menu__header" aria-hidden="true">
            <span className="account-menu__name">{name}</span>
            <span className="account-menu__email">{email}</span>
          </div>
          {items.map((item) => {
            const Icon = ITEM_ICONS[item.key] ?? User;
            return (
              <Link key={item.key} href={item.href} role="menuitem" tabIndex={-1} className="account-menu__item" onClick={() => close(false)}>
                <Icon aria-hidden="true" className="app-nav__icon" />{t(item.key as Parameters<typeof t>[0])}
              </Link>
            );
          })}
          <button type="button" role="menuitemcheckbox" aria-checked={accountReduceMotion} tabIndex={-1} className="account-menu__item"
            onClick={() => setReduceMotion(!accountReduceMotion)}>
            <Wind aria-hidden="true" className="app-nav__icon" />{t("account.reduceMotion")}
            <span className="account-menu__switch" data-on={accountReduceMotion} aria-hidden="true" />
          </button>
          <div role="separator" className="account-menu__divider" />
          <form action="/auth/signout" method="post">
            <button type="submit" role="menuitem" tabIndex={-1} className="account-menu__item account-menu__item--danger">
              <LogOut aria-hidden="true" className="app-nav__icon" />{tCommon("auth.signOut")}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
