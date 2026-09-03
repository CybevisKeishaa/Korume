import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { Problem } from "./problem";
import en from "@/messages/en/marketing.json";

/**
 * The six chip keys, DERIVED from the catalog rather than retyped (the pattern
 * `capability-chain.test.tsx` established for §6), so a copy pass that
 * re-voices a chip name — as 2026-09-01's did with "SRS Review" -> "SRS
 * review" — no longer turns this file red while the component is still right.
 *
 * ⚠️ Membership only, not order: `data-chip` is a valueless attribute here
 * (unlike §3's `data-step` and §6's `data-chain-node`), so there is nothing in
 * the DOM to compare an order against without changing the component.
 */
const CHIP_KEYS = Object.keys(en.problem.chips) as Array<keyof typeof en.problem.chips>;

describe("Problem", () => {
  it("renders all six capability chips", async () => {
    const { container } = render(await Problem());

    const chips = container.querySelectorAll("[data-chip]");
    expect(chips).toHaveLength(6);
    expect(CHIP_KEYS).toHaveLength(6);
    for (const key of CHIP_KEYS) {
      expect(screen.getByText(en.problem.chips[key].name)).toBeInTheDocument();
    }
  });

  it("gives every chip a DISTINCT sub-label — the frame repeats one placeholder six times", async () => {
    const { container } = render(await Problem());

    const details = Array.from(container.querySelectorAll("[data-chip-detail]")).map(
      (el) => el.textContent,
    );
    expect(details).toHaveLength(6);
    expect(new Set(details).size).toBe(6);
  });

  it("never renders the frame's placeholder sub-label", async () => {
    const { container } = render(await Problem());

    // ⚠️ Pinned literally ON PURPOSE, and NOT derivable from the catalog: this
    // is the Figma frame's repeated placeholder, which deliberately has no key
    // in `messages/`. Its absence is the assertion.
    expect(container.textContent).not.toContain("Learn in context");
  });

  it("centres the example sentence the six chips are about", async () => {
    render(await Problem());

    expect(screen.getByText(en.problem.example.jp)).toBeInTheDocument();
    expect(screen.getByText(en.problem.example.en)).toBeInTheDocument();
  });

  it("marks the constellation connectors decorative and hides them from assistive tech", async () => {
    const { container } = render(await Problem());

    const connectors = container.querySelectorAll("[data-connector]");
    expect(connectors).toHaveLength(1);
    expect(connectors[0]).toHaveAttribute("aria-hidden", "true");
  });

  it("holds the learner photograph as a real image with a recorded source", async () => {
    // Was a pending-slot guard until fix F7 supplied the photograph. Asserting
    // the exact path is asserting recorded provenance (spec §5.2 — the same
    // reasoning hero.test.tsx uses for the mascot poses): `progress.md` records
    // where `/marketing/problem-desk.png` came from, and nothing else may be
    // substituted here — least of all a slice of the reference PNG.
    const { container } = render(await Problem());

    expect(container.querySelectorAll('[data-asset-pending="true"]')).toHaveLength(0);

    const slots = Array.from(container.querySelectorAll("[data-asset-slot]"));
    expect(slots).toHaveLength(1);

    const photos = Array.from(container.querySelectorAll("[data-asset-slot] img"));
    expect(photos).toHaveLength(1);

    const [photo] = photos;
    if (!photo) throw new Error("the photograph slot rendered no <img>");
    // `next/image` rewrites src to `/_next/image?url=<encoded>&w=…`, so the
    // recorded path is asserted after decoding rather than against the raw
    // attribute — the subject is which FILE is served, not the optimizer URL.
    const photoSrc = decodeURIComponent(photo.getAttribute("src") ?? "");
    expect(photoSrc).toContain("/marketing/problem-desk.png");
    expect(photo.getAttribute("alt")).toBe(en.problem.photoAlt);
  });

  it("scopes the photograph's left-edge fade to the image, so a pending slot cannot fade", async () => {
    // The fade was deliberately withheld while the slot was empty: fading a
    // dashed placeholder into the background stops it reading as a placeholder,
    // which spec §5.2 forbids. The photograph exists now, so the fade ships —
    // but the reason has to survive as a property of the code, not as a memory.
    // Scoping the mask to a descendant `img` does that: `AssetSlot` renders an
    // `img` ONLY in its filled branch, so if `src` were removed the rule would
    // match nothing and the hard dashed boundary would return by itself.
    //
    // A className assertion is the right instrument only because jsdom applies
    // no Tailwind stylesheet, so there is no computed `mask-image` to read. The
    // subject is the SCOPE of the rule, which is expressed in the class name.
    const { container } = render(await Problem());

    const slots = Array.from(container.querySelectorAll("[data-asset-slot]"));
    expect(slots).toHaveLength(1);

    const [slot] = slots;
    if (!slot) throw new Error("the photograph slot did not render");
    const masks = slot.className
      .split(/\s+/)
      .filter((cls) => cls.includes("mask-image"));
    expect(masks).toHaveLength(1);
    for (const mask of masks) {
      expect(mask, "the fade must be scoped to a descendant img").toContain("[&_img]:");
    }
  });

  it("keeps the widened photograph behind the chips and unable to intercept them (fix F10)", async () => {
    // The photograph went 30% -> 41.5% of the section to match `346:6275`,
    // which puts its faded left edge over the constellation's right column.
    // Two properties make that safe, and neither is visible to jsdom — it does
    // no layout, so it can see neither the overlap nor the stacking order.
    // What it CAN pin is that both declarations are present, which is what a
    // later edit would silently drop:
    //  - the constellation is lifted into its own stacking context, so an
    //    absolutely-positioned photograph LATER in the subtree cannot paint
    //    over the chips (verified in a browser: at 1024/1280/1440/1920 the
    //    topmost element at each chip's inner right edge is the chip);
    //  - the photograph cannot be hit-tested at all, so even its transparent
    //    strip can never swallow a pointer aimed at the constellation
    //    (verified: `elementFromPoint` over the photograph returns the layout
    //    div behind it, never the slot).
    const { container } = render(await Problem());

    const slots = Array.from(container.querySelectorAll("[data-asset-slot]"));
    expect(slots).toHaveLength(1);

    const [slot] = slots;
    if (!slot) throw new Error("the photograph slot did not render");
    expect(
      slot.className,
      "the photograph overlaps the chips and must not be able to intercept them",
    ).toContain("pointer-events-none");

    const showcases = Array.from(container.querySelectorAll("[data-constellation]"));
    expect(showcases).toHaveLength(1);

    const [showcase] = showcases;
    if (!showcase) throw new Error("the constellation column did not render");
    expect(
      showcase.className,
      "the constellation must be lifted above the photograph it now overlaps",
    ).toContain("z-10");

    // Non-empty subject (docs/lessons.md L-004): the lift is worthless unless
    // every chip is actually inside the lifted layer.
    expect(container.querySelectorAll("[data-constellation] [data-chip]")).toHaveLength(6);
  });

  it("renders every leaf of the problem catalog subtree (dropped-key guard)", async () => {
    // Walks messages/en/marketing.json's `problem` subtree and collects every
    // string leaf, e.g. {a: {b: "x"}} -> [["a.b", "x"]]. Mirrors
    // site-footer.test.tsx / hero.test.tsx's equivalent guard, added there
    // after footer.note.heading/body shipped once with no test asserting
    // catalog coverage, only specific labels.
    function collectLeaves(
      value: unknown,
      path: string[] = [],
    ): Array<{ path: string; text: string }> {
      if (typeof value === "string") {
        return [{ path: path.join("."), text: value }];
      }
      if (value !== null && typeof value === "object") {
        return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
          collectLeaves(child, [...path, key]),
        );
      }
      return [];
    }

    const allLeaves = collectLeaves(en.problem);

    // Still NO exclusions, and still by path rather than by leaf name. What
    // changed with fix F7 is where one leaf lands: `photoAlt` used to be
    // visible `<span>` text in `AssetSlot`'s pending branch, and is now the
    // filled branch's `alt`. It is just as present and just as required — so
    // the guard widens to "visible text OR an image's accessible name" rather
    // than excusing the leaf. Dropping it to an exclusion would have made this
    // the one catalog key nothing checks.
    //
    // Explicit count (CLAUDE.md §7 / docs/lessons.md L-004): the walk must
    // find exactly the catalog's current shape, so an empty or mis-scoped
    // walk cannot pass vacuously, and a later task that adds a problem key
    // without rendering it drops this count.
    expect(allLeaves).toHaveLength(18);

    const { container } = render(await Problem());
    const alts = Array.from(container.querySelectorAll("img"))
      .map((img) => img.getAttribute("alt") ?? "")
      .filter((alt) => alt.length > 0);
    // Non-empty subject before relying on it (docs/lessons.md L-004): if the
    // photograph ever stopped rendering, `alts` would be empty and `photoAlt`
    // would silently have nowhere to be found rather than failing loudly.
    expect(alts).toHaveLength(1);

    const renderedText = [container.textContent ?? "", ...alts].join(" ");

    for (const { path, text } of allLeaves) {
      expect(renderedText, `problem.${path} = ${JSON.stringify(text)} did not render`).toContain(
        text,
      );
    }
  });

  it("gives every chip its own decorative line icon, hidden from assistive tech", async () => {
    // Task A1 (spec §13.1.2): the chips shipped as label-only rectangles. The
    // icons are pure decoration — every chip's meaning stays in its own text —
    // so they must be out of the accessibility tree AND out of the tab order.
    const { container } = render(await Problem());

    const icons = Array.from(container.querySelectorAll("[data-chip-icon]"));
    expect(icons).toHaveLength(6);

    expect(new Set(icons.map((el) => el.getAttribute("data-chip-icon")))).toEqual(
      new Set(["vocabulary", "grammar", "kanji", "pronunciation", "listening", "srs"]),
    );

    for (const icon of icons) {
      const key = icon.getAttribute("data-chip-icon");
      expect(icon, `${key} icon`).toHaveAttribute("aria-hidden", "true");
      expect(icon, `${key} icon`).toHaveAttribute("focusable", "false");
      expect(icon.closest("[data-chip]"), `${key} icon is not inside a chip`).not.toBeNull();
    }
  });

  it("draws SIX DIFFERENT glyphs, not one repeated six times", async () => {
    // The cheap failure a presence check would pass: six chips, one icon. The
    // subject is the rendered drawing, not the key the caller passed in.
    const { container } = render(await Problem());

    const shapes = Array.from(container.querySelectorAll("[data-chip-icon]")).map(
      (el) => el.innerHTML,
    );
    expect(shapes).toHaveLength(6);
    for (const shape of shapes) {
      expect(shape.length).toBeGreaterThan(0);
    }
    expect(new Set(shapes).size).toBe(6);
  });

  it("draws the constellation as three per-column layers with no stretched viewBox", async () => {
    // The defect this replaces: one overlay with `preserveAspectRatio="none"`
    // over a square viewBox, which sheared the rays and made the stroke width
    // and dash rhythm differ ray to ray. jsdom does no layout and CANNOT see
    // that the dashes are now even — what it CAN prove is that the stretching
    // attribute is gone and each column carries its own layer.
    const { container } = render(await Problem());

    const layer = container.querySelector("[data-connector]");
    expect(layer).not.toBeNull();

    const columns = Array.from(container.querySelectorAll("[data-connector-column]"));
    expect(columns).toHaveLength(3);
    expect(columns.map((el) => el.getAttribute("data-connector-column"))).toEqual([
      "left",
      "centre",
      "right",
    ]);

    for (const column of columns) {
      const name = column.getAttribute("data-connector-column");
      expect(column, `${name} column`).toHaveAttribute("focusable", "false");
      expect(column.getAttribute("preserveAspectRatio"), `${name} column`).toBeNull();
    }
  });

  it("keeps the connector layer unreachable and non-interactive", async () => {
    const { container } = render(await Problem());

    const layer = container.querySelector("[data-connector]");
    expect(layer).not.toBeNull();
    expect(layer).toHaveAttribute("aria-hidden", "true");
    expect(layer?.className).toContain("pointer-events-none");

    // Non-empty subject first (docs/lessons.md L-004): the layer really does
    // hold three drawings, so "no focusable descendant" is not vacuously true.
    expect(container.querySelectorAll("[data-connector] svg")).toHaveLength(3);
    expect(
      container.querySelectorAll(
        "[data-connector] a, [data-connector] button, [data-connector] input, [data-connector] [tabindex]",
      ),
    ).toHaveLength(0);
  });

  it("puts a single glowing node at the centre of the constellation", async () => {
    const { container } = render(await Problem());

    const nodes = Array.from(container.querySelectorAll("[data-connector-node]"));
    expect(nodes).toHaveLength(1);

    const [node] = nodes;
    if (!node) throw new Error("no [data-connector-node] was rendered");
    expect(node.closest('[data-connector-column="centre"]')).not.toBeNull();
  });

  it("steps all six chips continuously across the two rows", async () => {
    const { container } = render(await Problem());

    const chips = container.querySelectorAll("[data-chip]");
    expect(chips).toHaveLength(6);
    // Continuous, NOT restarting at 0 on the second row: the cascade reads as
    // six chips emerging from one sentence, not as two rows of three. A naive
    // per-row map gets exactly this wrong (Task A-MOTION).
    expect(
      Array.from(chips).map((c) =>
        (c as HTMLElement).style.getPropertyValue("--card-step").trim(),
      ),
    ).toEqual(["0", "1", "2", "3", "4", "5"]);
  });
});
