import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { Section } from "./section";

describe("Section", () => {
  it("renders the heading at level 2 by default and links it to the section", () => {
    render(
      <Section id="journey" eyebrow="Start with something real" heading="Don't study Japanese in isolation.">
        <p>body</p>
      </Section>,
    );

    const heading = screen.getByRole("heading", { level: 2, name: "Don't study Japanese in isolation." });
    expect(heading).toBeInTheDocument();

    const region = screen.getByRole("region", { name: "Don't study Japanese in isolation." });
    expect(region).toHaveAttribute("id", "journey");
  });

  it("renders the eyebrow as text, not as a heading", () => {
    render(
      <Section id="s" eyebrow="One learning journey" heading="Everything connects.">
        <p>body</p>
      </Section>,
    );

    expect(screen.getByText("One learning journey")).toBeInTheDocument();
    expect(screen.getAllByRole("heading")).toHaveLength(1);
  });

  it("omits the eyebrow element entirely when none is given", () => {
    const { container } = render(
      <Section id="s" heading="Only a heading">
        <p>body</p>
      </Section>,
    );

    expect(container.querySelectorAll("[data-eyebrow]")).toHaveLength(0);
  });

  it("renders its children", () => {
    render(
      <Section id="s" heading="H">
        <p>the body</p>
      </Section>,
    );

    expect(screen.getByText("the body")).toBeInTheDocument();
  });

  it("renders the heading at level 1 when headingLevel is 1, and still links it to the section", () => {
    render(
      <Section id="hero" heading="Learn Japanese through video." headingLevel={1}>
        <p>body</p>
      </Section>,
    );

    const heading = screen.getByRole("heading", { level: 1, name: "Learn Japanese through video." });
    expect(heading).toBeInTheDocument();

    const region = screen.getByRole("region", { name: "Learn Japanese through video." });
    expect(region).toHaveAttribute("id", "hero");
  });

  it("omits the rail element entirely in the stacked layout", () => {
    const { container } = render(
      <Section id="s" heading="Only a heading">
        <p>body</p>
      </Section>,
    );

    expect(container.querySelectorAll("[data-section-rail]")).toHaveLength(0);
  });

  it("moves body copy into a left rail when `rail` is given, without unlabelling the region", () => {
    // Task A1 (spec §13): the split layout is what fixes §2's composition, and
    // §3-§9 inherit it. The accessible structure must survive the change — one
    // heading, still level 2, still the region's name.
    render(
      <Section
        id="problem"
        eyebrow="Japanese isn't a textbook"
        heading="You can study Japanese for years."
        layout="split"
        rail={<p>Traditional study separates everything.</p>}
      >
        <p>the showcase</p>
      </Section>,
    );

    expect(screen.getByText("Traditional study separates everything.")).toBeInTheDocument();
    expect(screen.getByText("the showcase")).toBeInTheDocument();
    expect(screen.getByText("Japanese isn't a textbook")).toBeInTheDocument();

    const heading = screen.getByRole("heading", {
      level: 2,
      name: "You can study Japanese for years.",
    });
    expect(heading).toBeInTheDocument();
    expect(screen.getAllByRole("heading")).toHaveLength(1);

    const region = screen.getByRole("region", { name: "You can study Japanese for years." });
    expect(region).toHaveAttribute("id", "problem");
  });

  it("centres eyebrow, heading and showcase when `layout` is \"centred\"", () => {
    // §8's shape: a full-bleed band whose content is centred, with no rail and no
    // showcase column. Its heading is `text-title` (28px), not `text-display`
    // (40px) — calibrated against §7's rail heading, whose capital measures 12px
    // in `346:6275` and ships at `text-heading-lg` (24px); §8's measures 14px,
    // i.e. 24 * 14/12 = 28. So alignment and heading size really are two axes,
    // which is why one `layout` prop settles both rather than an `align` flag.
    const { container } = render(
      <Section id="cta" eyebrow="Ready when you are" heading="Start understanding." layout="centred">
        <p>the showcase</p>
      </Section>,
    );

    const heading = screen.getByRole("heading", { level: 2, name: "Start understanding." });
    expect(heading.className).toContain("text-title");
    expect(heading.className).not.toContain("text-display");
    expect(heading.className).not.toContain("text-heading-lg");

    // Centred layout has neither of the split's columns.
    expect(container.querySelectorAll("[data-section-showcase]")).toHaveLength(0);
    expect(container.querySelectorAll("[data-section-rail]")).toHaveLength(0);

    const centred = container.querySelector("[data-section-centred]");
    if (!centred) throw new Error("`layout=\"centred\"` rendered no centred wrapper");
    expect(centred.className).toContain("text-center");
    expect(screen.getByText("the showcase")).toBeInTheDocument();
  });

  it("selects the split layout from `layout` alone, with no rail element to show for it", () => {
    // §7 is the first section whose rail carries only the eyebrow and heading:
    // `346:6275` gives it no body paragraph and `messages/**` has no
    // `trust.body`. Under the original `rail != null` selector that shape could
    // not be expressed at all — `rail={null}` silently picked the STACKED
    // layout instead, which is the composition the user rejected in §2.
    const { container } = render(
      <Section id="trust" eyebrow="Your data belongs to you" heading="Private. Secure." layout="split">
        <p>the showcase</p>
      </Section>,
    );

    // The split's two columns exist...
    const showcase = container.querySelector("[data-section-showcase]");
    if (!showcase) throw new Error("layout='split' did not select the split layout");
    expect(showcase.textContent).toBe("the showcase");
    // ...and the heading takes the split's smaller token, not `text-display`.
    const heading = screen.getByRole("heading", { level: 2, name: "Private. Secure." });
    expect(heading.className).toContain("text-heading-lg");
    expect(heading.className).not.toContain("text-display");
    // ...but no empty rail wrapper is left behind to push `mt-md` of dead space
    // under the heading.
    expect(container.querySelectorAll("[data-section-rail]")).toHaveLength(0);
  });

  it("still stacks when no `layout` is given", () => {
    // The positive control for the cases above: `layout` must be what changed the
    // composition, not the mere presence of an eyebrow or of children.
    const { container } = render(
      <Section id="s" eyebrow="An eyebrow" heading="A heading">
        <p>the showcase</p>
      </Section>,
    );

    expect(container.querySelectorAll("[data-section-showcase]")).toHaveLength(0);
    expect(screen.getByRole("heading", { level: 2 }).className).toContain("text-display");
  });

  it("puts the rail beside the heading, not around the showcase", () => {
    // Guards the arrangement the composition depends on: rail copy shares the
    // narrow left column with the heading, and `children` stays out of it.
    const { container } = render(
      <Section id="s" heading="H" layout="split" rail={<p>rail copy</p>}>
        <p>showcase copy</p>
      </Section>,
    );

    const rails = Array.from(container.querySelectorAll("[data-section-rail]"));
    expect(rails).toHaveLength(1);

    const [rail] = rails;
    if (!rail) throw new Error("no [data-section-rail] was rendered");
    expect(rail.textContent).toBe("rail copy");

    const column = rail.parentElement;
    if (!column) throw new Error("the rail has no parent column");
    expect(column.querySelector("h2")).not.toBeNull();
    expect(column.textContent).not.toContain("showcase copy");
  });

  it("gives BOTH split columns min-w-0, so a wide showcase cannot widen the grid below `lg`", () => {
    // Task A2 review C1. `SPLIT_COLUMNS` is applied only at `lg:`. Below that
    // breakpoint the grid falls back to a single implicit `auto` track, and a
    // grid item's `min-width: auto` resolves to a CONTENT-BASED minimum. §3's
    // non-shrinking five-card row therefore pushed its own column to 572px
    // inside a 449px grid, giving the whole PAGE 212px of horizontal overflow
    // at a 375px viewport and clipping the heading and body copy — a WCAG
    // 1.4.10 (Reflow) failure, not just a visual one. `minmax(0, …)` supplies
    // the missing `0` at `lg` and above, which is why it was invisible at the
    // only width the implementer could measure.
    //
    // ⚠️ This asserts the MECHANISM, because jsdom does no layout. The OUTCOME
    // assertion — `documentElement.scrollWidth === clientWidth` at a 320px
    // viewport — is owed to the queued Playwright pass (Task 13/V); written
    // here it would be unconditionally green (CLAUDE.md §7).
    const { container } = render(
      <Section id="s" heading="H" layout="split" rail={<p>rail copy</p>}>
        <p>showcase copy</p>
      </Section>,
    );

    const rail = container.querySelector("[data-section-rail]");
    if (!rail) throw new Error("no [data-section-rail] was rendered");
    const railColumn = rail.parentElement;
    if (!railColumn) throw new Error("the rail has no parent column");

    const showcase = container.querySelector("[data-section-showcase]");
    if (!showcase) throw new Error("no [data-section-showcase] was rendered");

    // Both columns must be children of the SAME grid, or `min-w-0` is being
    // asserted on something that is not a grid item and proves nothing.
    const grid = railColumn.parentElement;
    if (!grid) throw new Error("the rail column has no parent grid");
    expect(showcase.parentElement).toBe(grid);
    expect(grid.className).toContain("grid");

    const columns = [railColumn, showcase];
    expect(columns).toHaveLength(2);
    for (const column of columns) {
      expect(
        column.className.split(/\s+/),
        `${column.hasAttribute("data-section-showcase") ? "showcase" : "rail"} column is missing min-w-0`,
      ).toContain("min-w-0");
    }
  });

  it.each(["stacked", "split", "centred"] as const)(
    "holds a %s section clear of the sticky header when it is the anchor target",
    (layout) => {
      // Task 11 review M1, measured in the browser at 1280 before this test was
      // written: `header` is `position: sticky` and occupies 0..64.67px, and NO
      // element in the repo set `scroll-margin-top`. Loading `/en#cta` put the
      // section's top at y = -0.03, so `#cta-heading` — the section's accessible
      // NAME via `aria-labelledby` — landed at 47.97px and its top ~16.7px
      // rendered underneath the bar.
      //
      // §2-§7 hid the defect rather than escaping it: each has an `eyebrow`, and
      // the eyebrow (decoration) is what lands in the header's strip instead of
      // the heading — measured at the same time, `#problem`'s eyebrow sits 22px
      // above its heading and `#trust`'s 40px. §8 and §9 are the first sections
      // with NO eyebrow, correctly so: the catalog has no `cta.eyebrow` /
      // `signoff.eyebrow` key and adding one would be inventing product copy.
      // So the clearance cannot be a consumer's job — it belongs to the
      // primitive, and must hold for a section with no decoration to spare.
      //
      // jsdom does no layout and cannot assert the OUTCOME; this guards the
      // MECHANISM. `scroll-mt-header` resolves to `--layout-header-height`, the
      // same token `site-header.tsx` sizes itself from, so the reservation
      // cannot go stale when the bar is resized — that half is pinned in
      // `site-header.test.tsx`.
      const { container } = render(
        layout === "split" ? (
          <Section id="s" heading="H" layout="split">
            <p>body</p>
          </Section>
        ) : (
          <Section id="s" heading="H" layout={layout}>
            <p>body</p>
          </Section>
        ),
      );

      const section = container.querySelector("section#s");
      if (!section) throw new Error(`the ${layout} layout rendered no section#s`);
      expect(section.className.split(/\s+/)).toContain("scroll-mt-header");
    },
  );
});
