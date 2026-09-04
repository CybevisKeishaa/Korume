import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { Trust, TRUST_CARDS, TRUST_PHOTO } from "./trust";
import en from "@/messages/en/marketing.json";

/** Narrows a query result, failing loudly instead of asserting on `null`. */
function must<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`expected to find ${what}`);
  return value;
}

/**
 * ⚠️ THE KEY SET IS PINNED LITERALLY AND THE WORDING IS NOT — the split task 9b
 * established, applied to the one section where it needs stating.
 *
 * Spec §11 ruling 11 calls these three claims "verbatim" promises matching the
 * `CLAUDE.md` §2 non-negotiables. The plan turned that into three hardcoded
 * English sentences. Two of the three are already DEAD: the owner's 2026-09-02
 * copy pass re-voiced `recordings.body` ("at rest" -> "while stored") and
 * `ai.name` ("AI with boundaries" -> "AI with clear boundaries"). So the bytes
 * were never the promise — the owner re-voices them at will, exactly as they
 * reserved the right to.
 *
 * What ruling 11 actually protects is that these three SUBJECTS ship and none
 * is quietly dropped or emptied. That is what this file pins: the three keys,
 * each rendering a non-empty name and body. Whether the sentences still state
 * the §2 promises is a reading task for review and for the owner, and a string
 * equality test cannot do it — it can only go red the next time they edit copy,
 * which is the defect task 9b removed from §0-§4.
 */
const CARD_KEYS = ["recordings", "data", "ai"] as const;

describe("Trust", () => {
  it("renders exactly the three trust cards the reference draws, in order", async () => {
    const { container } = render(await Trust());

    const cards = container.querySelectorAll("[data-trust-card]");
    expect(cards).toHaveLength(3);
    expect(CARD_KEYS).toHaveLength(3);
    expect(Array.from(cards).map((c) => c.getAttribute("data-trust-card"))).toEqual([
      ...CARD_KEYS,
    ]);
    // The component's own list must be the one under test, not a parallel copy
    // this file maintains by hand (CLAUDE.md §6, "one fact, one home").
    expect(TRUST_CARDS).toEqual(CARD_KEYS);
  });

  it("ships all three promises with a non-empty claim and body", async () => {
    render(await Trust());

    for (const key of CARD_KEYS) {
      const { name, body } = en.trust.cards[key];
      // Guards the empty-string case the loop above would otherwise pass: a
      // card rendering `""` still matches `[data-trust-card]`.
      expect(name.length, `${key}.name must not be empty`).toBeGreaterThan(0);
      expect(body.length, `${key}.body must not be empty`).toBeGreaterThan(0);
      expect(screen.getByText(name)).toBeInTheDocument();
      expect(screen.getByText(body)).toBeInTheDocument();
    }
  });

  it("gives each claim its own icon rather than one glyph three times", async () => {
    const { container } = render(await Trust());

    const icons = Array.from(container.querySelectorAll("[data-trust-icon]"));
    expect(icons).toHaveLength(3);

    const keys = icons.map((i) => i.getAttribute("data-trust-icon"));
    expect(keys).toEqual([...CARD_KEYS]);
    // The cheap failure this section invites: three cards, one padlock repeated.
    expect(new Set(icons.map((i) => i.innerHTML)).size).toBe(3);
  });

  it("keeps the icons decorative, since every claim's meaning is in its own text", async () => {
    const { container } = render(await Trust());

    for (const icon of container.querySelectorAll("[data-trust-icon]")) {
      expect(icon.getAttribute("aria-hidden")).toBe("true");
      expect(icon.getAttribute("focusable")).toBe("false");
    }
  });

  it("holds the lit-window photograph as a real image, not a pending slot", async () => {
    const { container } = render(await Trust());

    expect(container.querySelectorAll('[data-asset-pending="true"]')).toHaveLength(0);

    const photos = Array.from(container.querySelectorAll("[data-asset-slot] img"));
    expect(photos).toHaveLength(1);

    const [photo] = photos;
    if (!photo) throw new Error("the photograph slot rendered no <img>");
    // `next/image` rewrites `src` through the optimizer, so the committed path
    // survives only inside the encoded `url` param (same shape as §2's guard).
    expect(decodeURIComponent(photo.getAttribute("src") ?? "")).toContain(TRUST_PHOTO);
    expect(photo.getAttribute("alt")).toBe(en.trust.photoAlt);
  });

  it("keeps the overlapping photograph behind the cards and unable to intercept them", async () => {
    const { container } = render(await Trust());

    // §7 repeats §2's overlap exactly: the photograph bleeds to the page's right
    // edge and runs UNDER the third card, so it needs the same three mechanisms
    // §2's docblock records. All three are asserted, because any one of them
    // going missing is invisible until someone tries to read or click the card.
    const slot = must(container.querySelector("[data-asset-slot]"), "the photograph slot");

    //  1. a left-edge fade, so the overlapping strip is the fade's faintest part
    const maskClasses = slot.className.split(/\s+/).filter((c) => c.includes("mask-image"));
    expect(maskClasses.length, "the photograph must carry a left-edge fade").toBeGreaterThan(0);
    // Scoped to the descendant `img`, never the wrapper: an unfilled slot has no
    // `img` and so cannot fade a dashed placeholder into the page (spec §5.2).
    for (const cls of maskClasses) expect(cls).toContain("[&_img]");

    //  2. the cards are lifted above the photograph
    const cardList = must(container.querySelector("[data-trust-cards]"), "the card list");
    expect(cardList.className, "the cards must sit above the photograph").toContain("z-10");

    //  3. the photograph cannot be hit-tested, even where it is transparent
    expect(
      slot.className,
      "the photograph overlaps the cards and must not intercept them",
    ).toContain("pointer-events-none");
  });

  it("puts §7 in the split layout, with the rail carrying only eyebrow and heading", async () => {
    const { container } = render(await Trust());

    // The reference draws §7 as a rail split — settled by measurement during
    // task 9's review, and re-measured for this task off `346:6275`: the rail
    // holds the eyebrow and a two-line heading and NOTHING else, while three
    // equal cards fill the showcase. §7 is the first consumer of `Section`'s
    // split with no rail body, which is why `split` exists.
    const grid = must(container.querySelector("[data-section-showcase]"), "the showcase column")
      .parentElement;
    if (!grid) throw new Error("the showcase column has no parent grid");

    expect(screen.getByText(en.trust.eyebrow)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(en.trust.heading);
    // No rail body copy exists for §7 in the catalog, and inventing one would be
    // inventing product copy the Vietnamese pass would then have to match.
    expect(container.querySelectorAll("[data-section-rail]")).toHaveLength(0);
  });

  it("steps its three claim cards so they settle in order", async () => {
    const { container } = render(await Trust());

    const cards = container.querySelectorAll("[data-trust-card]");
    expect(cards).toHaveLength(3);
    expect(
      Array.from(cards).map((c) =>
        (c as HTMLElement).style.getPropertyValue("--card-step").trim(),
      ),
    ).toEqual(["0", "1", "2"]);
  });
});
