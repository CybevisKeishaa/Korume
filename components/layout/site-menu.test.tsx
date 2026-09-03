import { describe, expect, it } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/test/render";
import { SiteMenu } from "./site-menu";

/**
 * §0's mobile menu (task 13).
 *
 * ## Why this replaced the store links
 *
 * The user ruled on 2026-08-28 that below `md` there would be no hamburger and
 * that a phone visitor would be sent to the app stores instead. On 2026-09-03
 * they designed the mobile header in Figma (`429:716` / `433:1442`, menu
 * `434:1453`) as a wordmark plus a hamburger opening a full-width sheet. That
 * supersedes the earlier ruling, and it is also what made the page pass WCAG
 * 1.4.10 Reflow at 320px: the bar had four clusters competing for 288px and
 * needed 380.6px (en) / 403.1px (vi) to render them unwrapped.
 *
 * ## Disclosure, not a modal
 *
 * The design draws no scrim and leaves the page visible below the sheet, so
 * this is the disclosure pattern — `aria-expanded` + `aria-controls` — not
 * `components/ui/dialog.tsx`. That primitive is a Radix modal: it would add a
 * scrim, lock scrolling and trap focus, none of which the design has.
 */
const ITEMS = [
  { key: "explore", href: "/shadowing/explore", label: "Explore" },
  { key: "shadowing", href: "/shadowing", label: "Shadowing" },
  { key: "kanji", href: "/kanji", label: "Kanji" },
] as const;

const LABELS = {
  open: "Open menu",
  close: "Close menu",
  nav: "Primary navigation",
  signIn: "Log in",
  cta: "Start learning",
} as const;

const renderMenu = () =>
  render(
    <SiteMenu
      items={ITEMS}
      labels={LABELS}
      signInHref="/login"
      ctaHref="/register"
    />,
  );

describe("SiteMenu", () => {
  it("starts closed, with the panel its button names still in the document", async () => {
    renderMenu();

    const toggle = screen.getByRole("button", { name: LABELS.open });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    // The panel is rendered and `hidden` rather than unmounted: `aria-controls`
    // must resolve to a real element, and a dangling id is a broken reference
    // rather than a closed menu.
    const panelId = toggle.getAttribute("aria-controls");
    expect(panelId).toBeTruthy();
    const panel = document.getElementById(panelId as string);
    expect(panel).not.toBeNull();
    expect(panel).not.toBeVisible();
  });

  it("opens onto exactly the destinations it was given, in order", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: LABELS.open }));

    const nav = screen.getByRole("navigation", { name: LABELS.nav });
    const links = Array.from(nav.querySelectorAll("a[data-menu-item]"));
    // A pattern-gathered collection must be constrained in size too, or an
    // empty match passes unconditionally (CLAUDE.md §7).
    expect(ITEMS).toHaveLength(3);
    expect(links).toHaveLength(ITEMS.length);
    expect(links.map((a) => [a.textContent, a.getAttribute("href")])).toEqual(
      ITEMS.map((item) => [item.label, `/en${item.href}`]),
    );
  });

  it("carries sign-in and the get-started CTA inside the panel", async () => {
    // Figma's sheet draws the CTA only. Sign-in is kept because the sheet IS
    // the whole mobile nav now — without it a returning visitor on a phone has
    // no way into their account at all, which is a functional hole rather than
    // a styling choice. Flagged to the owner; one line removes it.
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole("button", { name: LABELS.open }));

    expect(screen.getByRole("link", { name: LABELS.cta })).toHaveAttribute(
      "href",
      "/en/register",
    );
    expect(screen.getByRole("link", { name: LABELS.signIn })).toHaveAttribute(
      "href",
      "/en/login",
    );
  });

  it("closes on Escape and puts focus back on the button that opened it", async () => {
    const user = userEvent.setup();
    renderMenu();

    const toggle = screen.getByRole("button", { name: LABELS.open });
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{Escape}");

    // The button is renamed by state, so re-query it by its closed name.
    const reopened = screen.getByRole("button", { name: LABELS.open });
    expect(reopened).toHaveAttribute("aria-expanded", "false");
    // WCAG 2.4.3: focus must not be dumped at the top of the document.
    expect(reopened).toHaveFocus();
  });

  it("closes when a destination is chosen, so the sheet is not left over the page", async () => {
    const user = userEvent.setup();
    renderMenu();
    const toggle = screen.getByRole("button", { name: LABELS.open });
    await user.click(toggle);

    const destination = screen.getByRole("link", { name: ITEMS[0].label });
    // jsdom cannot navigate, and letting the click through prints "Not
    // implemented: navigation" to stderr. The behaviour under test is the
    // handler on the link, not the navigation the browser would then do.
    destination.addEventListener("click", (event) => event.preventDefault());
    await user.click(destination);

    expect(
      screen.getByRole("button", { name: LABELS.open }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("closes on a press outside itself", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole("button", { name: LABELS.open }));

    await user.click(document.body);

    expect(
      screen.getByRole("button", { name: LABELS.open }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("closes when focus leaves it, so no stop lands behind the sheet", async () => {
    // The sheet is a disclosure, not a modal, so focus is not trapped — and
    // measured in the browser, tabbing past the last row put focus on the hero
    // CTA *underneath* the opaque panel: an outline nobody can see, which is
    // WCAG 2.4.7 failing at exactly one step. Closing on focus-out is what
    // keeps the pattern non-modal and still leaves every stop visible.
    const user = userEvent.setup();
    render(
      <>
        <SiteMenu
          items={ITEMS}
          labels={LABELS}
          signInHref="/login"
          ctaHref="/register"
        />
        <a href="/somewhere">the page behind the sheet</a>
      </>,
    );

    await user.click(screen.getByRole("button", { name: LABELS.open }));
    // Every stop the sheet owns — a row each, then the CTA, then sign-in —
    // and one more, which is the step that used to land behind the panel.
    const stopsInsideTheSheet = ITEMS.length + 2;
    for (let i = 0; i <= stopsInsideTheSheet; i++) await user.tab();

    expect(
      screen.getByRole("link", { name: "the page behind the sheet" }),
    ).toHaveFocus();
    expect(
      screen.getByRole("button", { name: LABELS.open }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("keeps every glyph out of the accessibility tree", async () => {
    // The hamburger, the ✕ and the row chevrons are decoration: the button's
    // and the links' names are text, and a glyph that announced itself would
    // read twice.
    const user = userEvent.setup();
    const { container } = renderMenu();
    await user.click(screen.getByRole("button", { name: LABELS.open }));

    const glyphs = Array.from(container.querySelectorAll("svg"));
    expect(glyphs.length).toBeGreaterThan(0);
    expect(
      glyphs.filter((g) => g.getAttribute("aria-hidden") !== "true"),
    ).toEqual([]);
  });
});
