import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { Recommendation, STILL_SIZES } from "./recommendation";
import { CIRCUMFERENCE, arcLength } from "./recommendation-donut";
import en from "@/messages/en/marketing.json";

/** Narrows a query result, failing loudly instead of asserting on `null`. */
function must<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`expected to find ${what}`);
  return value;
}

/**
 * Asserts `selector` matches nothing under `root` — after PROVING the selector
 * can match, by inserting a node that satisfies it and watching the count hit 1.
 *
 * CLAUDE.md §7: a bare `toHaveLength(0)` over a pattern-gathered collection is
 * green when the invariant holds AND green when the selector is simply wrong.
 * The positive control is what makes the negative assertion mean anything.
 * (Same helper shape as `pitch-showcase.test.tsx`'s.)
 */
function expectSelectorMatchesNothing(
  root: ParentNode,
  selector: string,
  probeParent: Element,
  probe: Element,
): void {
  expect(root.querySelectorAll(selector), `"${selector}" must match nothing`).toHaveLength(0);
  probeParent.appendChild(probe);
  expect(
    root.querySelectorAll(selector),
    `positive control: "${selector}" must find the probe it was given`,
  ).toHaveLength(1);
  probe.remove();
}

/** The leading `<dash length>` of a `stroke-dasharray="<len> <gap>"` pair. */
function drawnLength(dashArray: string): number {
  const first = dashArray.trim().split(/[\s,]+/)[0];
  return Number(first);
}

describe("Recommendation", () => {
  it("renders exactly the three showcase cards the reference draws", async () => {
    const { container } = render(await Recommendation());

    const cards = container.querySelectorAll("[data-recommend-card]");
    expect(cards).toHaveLength(3);
    expect(Array.from(cards).map((c) => c.getAttribute("data-recommend-card"))).toEqual([
      "video",
      "familiar",
      "why",
    ]);
  });

  it("gives the familiar-words figure its percent treatment", async () => {
    const { container } = render(await Recommendation());

    const value = must(container.querySelector("[data-familiar-value]"), "the familiar value");
    const unit = must(container.querySelector("[data-familiar-unit]"), "the familiar unit");

    // Separate elements, so the unit can be typeset smaller than the number.
    expect(value).not.toBe(unit);
    expect(value.textContent).toBe(en.recommend.familiar.value);
    expect(unit.textContent).toBe(en.recommend.familiar.unit);
    // Task 8 R2/token decision: `text-title` (28px) is the plan's generic
    // percent-treatment token, but it is sized for a full-width figure, not a
    // 72px ring with a ~54px inner disc (`FamiliarDonut`'s own comment: 75% of
    // its SIZE). Measured live at 1280 (task-8 report screenshot): "96" at
    // `text-title` crowds the stroke; at `text-heading` (20px) it sits clear of
    // the ring with room for the "%" beside it. `text-heading` is the token
    // that is actually right *inside the donut*, which is what R2 asks for.
    expect(value.className).toContain("text-heading");
    expect(unit.className).not.toContain("text-heading");

    expect(screen.getByText(en.recommend.familiar.label)).toBeInTheDocument();
    expect(screen.getByText(en.recommend.familiar.body)).toBeInTheDocument();
  });

  it("lists the four reasons under the 'Why this video?' heading", async () => {
    const { container } = render(await Recommendation());

    const reasons = container.querySelectorAll("[data-reason]");
    expect(reasons).toHaveLength(4);
    expect(Array.from(reasons).map((r) => r.textContent)).toEqual([
      en.recommend.why.vocabulary,
      en.recommend.why.speed,
      en.recommend.why.expressions,
      en.recommend.why.difficulty,
    ]);
    expect(screen.getByText(en.recommend.why.heading)).toBeInTheDocument();
  });

  it("renders the real photograph, with no pending slot left in the section", async () => {
    // Replaces the plan's `[data-asset-pending="true"]` assertion:
    // `public/marketing/recommend-commute.png` was committed in b30661f, so the
    // slot is filled and a pending placeholder here would now be the defect.
    const { container } = render(await Recommendation());

    const still = must(
      container.querySelector<HTMLImageElement>("[data-recommend-card='video'] img"),
      "the video still",
    );
    expect(still).toHaveAttribute("alt", en.recommend.stillAlt);
    // next/image rewrites `src` through the optimizer, so the file name is what
    // survives — the assertion is "this slot points at the committed file".
    expect(still.getAttribute("src")).toContain("recommend-commute.png");
    // Pinned to the EXACT hint, not just "present" or "non-empty": `AssetSlot`
    // renders `sizes={sizes ?? DEFAULT_SIZES}` (asset-slot.tsx), so the
    // attribute is NEVER absent or empty — a bare `toHaveAttribute("sizes")` /
    // `not.toBe("")` pair is green whether or not `STILL_SIZES` is actually
    // wired at this call site, because `AssetSlot`'s own 45vw upper-bound
    // fallback satisfies both just as well (review fix round 1, task 8).
    // Asserting equality to the exported constant also pins the pure-px
    // invariant `recommendation.tsx`'s docblock calls load-bearing: `STILL_SIZES`
    // carries no `vw` term, so this one assertion catches both a missing
    // `sizes` prop AND a regression back to a `vw`-based hint.
    expect(still.getAttribute("sizes")).toBe(STILL_SIZES);

    const probe = document.createElement("div");
    probe.setAttribute("data-asset-pending", "true");
    expectSelectorMatchesNothing(
      container,
      "[data-asset-pending='true']",
      must(container.querySelector("[data-recommend-card='video']"), "the video card"),
      probe,
    );
  });

  it("keeps the donut decorative — the percentage is readable as text, not only as an arc", async () => {
    const { container } = render(await Recommendation());

    const donut = must(container.querySelector("[data-familiar-donut]"), "the donut");
    expect(donut.tagName.toLowerCase()).toBe("svg");
    expect(donut).toHaveAttribute("aria-hidden", "true");
    expect(donut).toHaveAttribute("focusable", "false");
    expect(donut).not.toHaveAttribute("role");

    // Nothing inside it may re-enter the accessibility tree or the tab order.
    const inside = donut.querySelectorAll("*");
    expect(inside.length).toBeGreaterThan(0);
    for (const node of Array.from(inside)) {
      expect(node).not.toHaveAttribute("role");
      expect(node).not.toHaveAttribute("aria-label");
      expect(node).not.toHaveAttribute("tabindex");
    }

    // The figure's meaning lives in real text beside the arc, so removing the
    // SVG would cost the section its texture and no meaning at all.
    donut.remove();
    expect(screen.getByText(en.recommend.familiar.value)).toBeInTheDocument();
    expect(screen.getByText(en.recommend.familiar.unit)).toBeInTheDocument();
  });

  it("derives the arc's sweep from the catalog value rather than drawing a full ring", async () => {
    const { container } = render(await Recommendation());

    const arc = must(container.querySelector("[data-familiar-arc]"), "the donut arc");
    const dashArray = must(arc.getAttribute("stroke-dasharray"), "the arc's stroke-dasharray");

    const percent = Number(en.recommend.familiar.value);
    expect(Number.isFinite(percent)).toBe(true);
    expect(drawnLength(dashArray)).toBeCloseTo(arcLength(percent), 6);

    // 96 is not 100: a full ring would say "you know all of it" and is exactly
    // what a hard-coded arc would draw.
    expect(drawnLength(dashArray)).toBeLessThan(CIRCUMFERENCE);
    expect(drawnLength(dashArray) / CIRCUMFERENCE).toBeCloseTo(percent / 100, 6);
  });

  it("maps a percentage onto arc length linearly, and clamps out-of-range input", () => {
    expect(arcLength(0)).toBe(0);
    expect(arcLength(100)).toBeCloseTo(CIRCUMFERENCE, 6);
    expect(arcLength(50)).toBeCloseTo(CIRCUMFERENCE / 2, 6);
    expect(arcLength(25)).toBeCloseTo(CIRCUMFERENCE / 4, 6);
    // The catalog is user-editable copy; a nonsense value must not draw an arc
    // longer than the ring it sits on.
    expect(arcLength(140)).toBeCloseTo(CIRCUMFERENCE, 6);
    expect(arcLength(-20)).toBe(0);
    expect(arcLength(Number.NaN)).toBe(0);
  });

  it("renders every `recommend.*` string the section owns", async () => {
    render(await Recommendation());

    const owned = [
      en.recommend.eyebrow,
      en.recommend.heading,
      en.recommend.body,
      en.recommend.cardHeading,
      en.recommend.video.jp,
      en.recommend.video.en,
      en.recommend.familiar.value,
      en.recommend.familiar.unit,
      en.recommend.familiar.label,
      en.recommend.familiar.body,
      en.recommend.cta,
      en.recommend.why.heading,
      en.recommend.why.vocabulary,
      en.recommend.why.speed,
      en.recommend.why.expressions,
      en.recommend.why.difficulty,
    ];
    // Non-empty and the size expected: an empty list would make the loop below
    // unconditionally green (CLAUDE.md §7).
    expect(owned).toHaveLength(16);
    for (const text of owned) {
      expect(screen.getByText(text), `catalog string "${text}" must reach the DOM`).toBeInTheDocument();
    }
  });

  it("names the section's region and its call to action", async () => {
    const { container } = render(await Recommendation());

    const section = must(container.querySelector("section#recommend"), "the #recommend section");
    expect(section).toHaveAccessibleName(en.recommend.heading);

    const cta = screen.getByRole("link", { name: en.recommend.cta });
    expect(cta).toHaveAttribute("href", "/en/shadowing/explore");
  });
});
