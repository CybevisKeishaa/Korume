"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Link } from "@/lib/i18n/navigation";
import { buttonStyles } from "@/components/ui/button";
import { MarketingContainer } from "@/components/marketing/marketing-container";
import { ChevronRightGlyph, CloseGlyph, MenuGlyph } from "./site-menu-icon";

export interface SiteMenuItem {
  readonly key: string;
  readonly href: string;
  readonly label: string;
}

export interface SiteMenuLabels {
  readonly open: string;
  readonly close: string;
  readonly nav: string;
  readonly signIn: string;
  readonly cta: string;
}

export interface SiteMenuProps {
  /**
   * The destinations, resolved by the server component that owns them. They
   * are NOT re-declared here: `site-header.tsx`'s `NAV_ITEMS` is the one home
   * for the marketing IA, and the desktop row and this sheet render the same
   * list (CLAUDE.md §6).
   */
  items: readonly SiteMenuItem[];
  labels: SiteMenuLabels;
  signInHref: string;
  ctaHref: string;
}

/**
 * §0's mobile menu — the hamburger and the sheet it opens (Figma `433:1442`,
 * menu `434:1453`, owner's design 2026-09-03).
 *
 * ## Why this exists at all
 *
 * It replaces the App Store / Google Play pair that stood in for a hidden nav
 * below `md`. That pair came from the user's 2026-08-28 ruling ("no
 * hamburger"); their Figma mobile header supersedes it. The reflow arithmetic
 * says the same thing independently: at 320px the bar has 288px of room and
 * its four clusters need 380.6px (en) / 403.1px (vi) before any label wraps,
 * so nothing that keeps all four in one row can pass WCAG 1.4.10.
 *
 * ## Disclosure, not a modal
 *
 * The design draws no scrim and leaves the page visible under the sheet, so
 * this is a disclosure — a button with `aria-expanded`/`aria-controls` over a
 * panel — rather than `components/ui/dialog.tsx`, which is a Radix modal and
 * would add a scrim, a scroll lock and a focus trap the design does not have.
 * Escape and an outside press both close it, and focus returns to the button.
 *
 * ## `absolute`, not `fixed`
 *
 * The bar carries `backdrop-blur`, and a backdrop filter makes its element a
 * containing block for fixed descendants — a `fixed inset-x-0` panel in here
 * would anchor to the 64px bar, not the viewport, and look correct only by
 * accident. `absolute top-full` on the sticky `<header>` is what the design
 * draws anyway: a sheet hanging off the bar and travelling with it.
 *
 * ## No transition
 *
 * Deliberate. Task A-MOTION owns this page's motion pass and is still open;
 * adding one here would also turn §2's currently vacuous reduced-motion gate
 * into a real requirement in a task that is not the motion task.
 */
export function SiteMenu({ items, labels, signInHref, ctaHref }: SiteMenuProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      // WCAG 2.4.3: dismissing must not drop focus at the top of the document.
      toggleRef.current?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && rootRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div
      ref={rootRef}
      className="md:hidden"
      // Focus is NOT trapped — this is a disclosure, not a modal. Measured in
      // a real browser at 390px, tabbing past the last row put focus on the
      // hero's CTA *underneath* the opaque sheet: a focus ring nobody can see,
      // which is WCAG 2.4.7 failing at exactly one step. Closing on focus-out
      // keeps the pattern non-modal and every stop visible.
      onBlur={(event) => {
        if (!open) return;
        // Focus left the document entirely (alt-tab, a click in the address
        // bar). Nothing underneath the sheet has focus, so there is no
        // invisible focus ring to prevent — and closing here would mean the
        // reader comes back to a menu they did not shut.
        if (event.relatedTarget === null) return;
        if (event.currentTarget.contains(event.relatedTarget)) return;
        setOpen(false);
      }}
    >
      <button
        ref={toggleRef}
        type="button"
        data-menu-toggle
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? labels.close : labels.open}
        onClick={() => setOpen((previous) => !previous)}
        className="grid size-8 place-items-center rounded-full border border-border text-foreground transition-colors hover:bg-secondary"
      >
        {open ? (
          <CloseGlyph className="size-4" />
        ) : (
          <MenuGlyph className="size-4" />
        )}
      </button>

      {/* Rendered and `hidden` rather than unmounted: `aria-controls` has to
          resolve to a real element, and a dangling id is a broken reference,
          not a closed menu. `hidden` also takes the links out of the tab
          order, so a closed sheet costs no keyboard stops.

          ⚠️ `[&[hidden]]:hidden` is not redundant. Tailwind's preflight rule is
          `[hidden]:where(:not([hidden="until-found"])){display:none}`, and
          `:where()` contributes ZERO specificity — so that rule merely TIES
          with any single utility class and loses on source order. The day
          someone adds `block`, `flex` or `grid` here, the closed menu renders
          over the hero and no test goes red. This makes the closed state win
          on its own terms. */}
      <div
        id={panelId}
        hidden={!open}
        className="absolute inset-x-0 top-full z-nav border-b border-border/60 bg-background pb-lg pt-lg [&[hidden]]:hidden"
      >
        <MarketingContainer>
          <nav aria-label={labels.nav}>
            <ul>
              {items.map((item) => (
                <li key={item.key}>
                  <Link
                    data-menu-item
                    href={item.href}
                    onClick={close}
                    className="flex items-center justify-between border-b border-border/60 py-md text-body text-foreground transition-colors hover:text-primary"
                  >
                    {item.label}
                    <ChevronRightGlyph className="size-[0.9375rem] shrink-0 text-primary" />
                  </Link>
                </li>
              ))}
            </ul>

            <Link
              href={ctaHref}
              onClick={close}
              className={buttonStyles({ className: "mt-lg w-full" })}
            >
              {labels.cta}
            </Link>
            {/* Not in the design's sheet. Kept because this sheet IS the whole
                mobile nav now, and without it a returning visitor on a phone
                has no route into their account — a functional hole rather than
                a styling choice. Raised with the owner; one line removes it. */}
            <Link
              href={signInHref}
              onClick={close}
              className="mt-sm block text-center text-body text-muted-foreground transition-colors hover:text-foreground"
            >
              {labels.signIn}
            </Link>
          </nav>
        </MarketingContainer>
      </div>
    </div>
  );
}
