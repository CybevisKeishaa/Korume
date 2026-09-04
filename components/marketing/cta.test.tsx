import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { Cta, CTA_BACKGROUND, CTA_MASCOT, CTA_SCRIM } from "./cta";
import en from "@/messages/en/marketing.json";

/** Narrows a query result, failing loudly instead of asserting on `null`. */
function must<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`expected to find ${what}`);
  return value;
}

describe("Cta", () => {
  it("offers both calls to action, with the catalog's wording", async () => {
    render(await Cta());

    // Destinations are pinned literally — they are the contract. The LABELS come
    // from the catalog, because the owner re-voices copy at will: the plan's own
    // test typed "Start Learning" and "Explore Lessons", and the catalog now says
    // "Start learning" and "Explore lessons".
    const primary = screen.getByRole("link", { name: en.cta.primary });
    const secondary = screen.getByRole("link", { name: en.cta.secondary });

    expect(primary).toHaveAttribute("href", "/en/register");
    expect(secondary).toHaveAttribute("href", "/en/shadowing/explore");
    expect(primary).not.toBe(secondary);
  });

  it("gives the two actions different visual weight", async () => {
    render(await Cta());

    // The reference draws one filled button and one outlined: a page-level CTA
    // that offers two equally-weighted choices offers no choice at all.
    const primary = screen.getByRole("link", { name: en.cta.primary });
    const secondary = screen.getByRole("link", { name: en.cta.secondary });

    expect(primary.className).toContain("bg-primary");
    expect(secondary.className).toContain("border");
    expect(secondary.className).not.toContain("bg-primary");
  });

  it("renders heading, body and note from the catalog", async () => {
    render(await Cta());

    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(en.cta.heading);
    expect(screen.getByText(en.cta.body)).toBeInTheDocument();
    expect(screen.getByText(en.cta.note)).toBeInTheDocument();
  });

  it("holds the bridge photograph as a real image, not a pending slot", async () => {
    const { container } = render(await Cta());

    expect(container.querySelectorAll('[data-asset-pending="true"]')).toHaveLength(0);

    const photos = Array.from(container.querySelectorAll("[data-asset-slot] img"));
    expect(photos).toHaveLength(1);
    const [photo] = photos;
    if (!photo) throw new Error("the background slot rendered no <img>");
    expect(decodeURIComponent(photo.getAttribute("src") ?? "")).toContain(CTA_BACKGROUND);
    expect(photo.getAttribute("alt")).toBe(en.cta.backgroundAlt);
  });

  it("puts a scrim between the photograph and the text", async () => {
    const { container } = render(await Cta());

    // ⚠️ NOT decoration. `cta-bridge.png` is mostly very dark, but its lanterns
    // are near-white: measured over the central 70% x 60% of the file, the 99th
    // percentile of pixel luminance gives white text only 2.28:1 and the maximum
    // gives 1.00:1, against the 4.5:1 WCAG AA floor. Without a scrim this section
    // ships text that is illegible wherever it crosses a light.
    const scrim = must(container.querySelector("[data-cta-scrim]"), "the scrim");
    expect(scrim.className).toContain(CTA_SCRIM);
    // It must sit ABOVE the photograph and BELOW the text, so asserting it exists
    // is not enough — the order in the DOM is what puts it between them.
    const slot = must(container.querySelector("[data-asset-slot]"), "the photograph");
    expect(slot.compareDocumentPosition(scrim) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(scrim.getAttribute("aria-hidden")).toBe("true");
  });

  it("sets §8's copy in the foreground colour, because it sits on a photograph", async () => {
    const { container } = render(await Cta());

    // ⚠️ NOT a style preference. `text-muted-foreground` is the right token for
    // secondary copy on this page's flat surfaces and every other section uses
    // it — but over `cta-bridge.png` behind a 70% scrim it measures 3.75:1 for
    // the body and 2.41:1 for the note, both under the 4.5:1 AA floor. The same
    // regions in `--foreground` measure 10.92:1 and 7.00:1. Raising the scrim
    // instead was measured and rejected: at 80% the note still only reaches
    // 3.49:1 and the photograph is nearly a flat rectangle.
    const copy = Array.from(container.querySelectorAll("p"));
    expect(copy.length, "§8 renders no paragraphs to check").toBe(2);
    for (const p of copy) {
      expect(p.className, "copy over the photograph must not use the muted token").not.toContain(
        "text-muted-foreground",
      );
      expect(p.className).toContain("text-foreground");
    }
  });

  it("keeps the background and scrim unable to intercept the buttons", async () => {
    const { container } = render(await Cta());

    // Both layers cover the whole band, including the two links. §2 and §7 record
    // the same requirement for their photographs; here it is the difference
    // between a working CTA and a dead one.
    for (const sel of ["[data-asset-slot]", "[data-cta-scrim]"]) {
      const layer = must(container.querySelector(sel), sel);
      expect(layer.className, `${sel} must not intercept the buttons`).toContain(
        "pointer-events-none",
      );
    }
  });

  it("renders the mascot from the supplied pose library, never a Blender render", async () => {
    const { container } = render(await Cta());

    const mascot = must(container.querySelector("[data-mascot]"), "the mascot");
    const src = decodeURIComponent(mascot.getAttribute("src") ?? "");
    expect(src).toContain(CTA_MASCOT);
    // Blender renders were rejected by the user (spec §5.3).
    expect(src).not.toContain("/renders/");
    // `mix-blend-mode: screen` was retired once the poses had real alpha; §4 and
    // §6 already guard this and §8 is the third placement.
    expect(mascot.className).not.toContain("mix-blend");
    expect(mascot.getAttribute("alt")).toBe(en.cta.mascotAlt);
  });
});
