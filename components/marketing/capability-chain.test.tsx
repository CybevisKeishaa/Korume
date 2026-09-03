import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { CapabilityChain, MASCOT_POSE, MASCOT_SIZES } from "./capability-chain";
import en from "@/messages/en/marketing.json";

/** Narrows a query result, failing loudly instead of asserting on `null`. */
function must<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`expected to find ${what}`);
  return value;
}

/**
 * The eight node keys, DERIVED from the catalog rather than retyped here.
 *
 * The plan's own test block hardcoded the eight English names and then asserted
 * `expect(NODE_NAMES).toHaveLength(8)` on the constant it had just written —
 * an assertion that cannot fail, of the shape already raised as an Important
 * finding on this branch (task P, P-F1). Reading the keys and the strings out
 * of `messages/en/marketing.json` (the way `recommendation.test.tsx` does with
 * `en.recommend.*`) means a catalog edit shows up here instead of drifting
 * silently away from the component.
 */
const NODE_KEYS = Object.keys(en.chain.nodes) as Array<keyof typeof en.chain.nodes>;

/**
 * The connector count this build actually draws, expressed as the RULE that
 * produces it rather than as the number 15 (T9-R5: the plan pinned `1`, which
 * would have made the correct two-layer build fail; a bare literal here would
 * be the same mistake with a different number).
 *
 *  - layer A: one dashed segment from each node's centre to the NEXT node's
 *    centre, so every node but the last carries one — `n - 1`.
 *  - layer B: one rail segment per node, so the rail tiles across a row and
 *    redraws itself per row when the grid wraps — `n`.
 */
const EXPECTED_CONNECTORS = NODE_KEYS.length - 1 + NODE_KEYS.length;

describe("CapabilityChain", () => {
  it("renders all eight capability nodes", async () => {
    const { container } = render(await CapabilityChain());

    const nodes = container.querySelectorAll("[data-chain-node]");
    expect(nodes).toHaveLength(8);
    // The catalog is the source of both the keys and the copy, so this pins
    // "eight nodes, in catalog order, each showing its own name".
    expect(NODE_KEYS).toHaveLength(8);
    expect(Array.from(nodes).map((n) => n.getAttribute("data-chain-node"))).toEqual(NODE_KEYS);
    for (const key of NODE_KEYS) {
      expect(screen.getByText(en.chain.nodes[key].name)).toBeInTheDocument();
    }
  });

  it("gives every node a DISTINCT caption — the frame repeats one placeholder eight times", async () => {
    const { container } = render(await CapabilityChain());

    const captions = Array.from(container.querySelectorAll("[data-chain-caption]")).map(
      (el) => el.textContent,
    );
    expect(captions).toHaveLength(8);
    expect(new Set(captions).size).toBe(8);
  });

  it("never renders the frame's placeholder caption", async () => {
    const { container } = render(await CapabilityChain());

    expect(container.textContent).not.toContain("Learn naturally, one layer at a time.");
  });

  it("threads the nodes with decorative connectors hidden from assistive tech", async () => {
    const { container } = render(await CapabilityChain());

    const thread = container.querySelectorAll("[data-connector]");
    // Non-empty AND the exact size the rule above derives: a pattern-gathered
    // collection asserted only element-by-element is unconditionally green when
    // the selector matches nothing (CLAUDE.md §7, docs/lessons.md L-004).
    expect(thread.length).toBeGreaterThan(0);
    expect(thread).toHaveLength(EXPECTED_CONNECTORS);

    for (const el of Array.from(thread)) {
      // Hidden from AT: the order the thread expresses is already the reading
      // order of the list, so announcing it would repeat, not inform.
      expect(el).toHaveAttribute("aria-hidden", "true");
      // Non-focusable, and nothing inside it re-enters the tab order or the
      // accessibility tree.
      expect(el).not.toHaveAttribute("tabindex");
      expect(el.tagName.toLowerCase()).toBe("span");
      // Carries no content — it is a drawn line, not a label.
      expect(el.textContent).toBe("");
      const inside = el.querySelectorAll("*");
      for (const child of Array.from(inside)) {
        expect(child).not.toHaveAttribute("tabindex");
        expect(child).not.toHaveAttribute("role");
        expect(child).not.toHaveAttribute("aria-label");
      }
    }
  });

  it("gives each node its OWN icon rather than one glyph eight times", async () => {
    const { container } = render(await CapabilityChain());

    const icons = container.querySelectorAll("[data-chain-icon]");
    expect(icons).toHaveLength(8);
    const keys = Array.from(icons).map((i) => i.getAttribute("data-chain-icon"));
    expect(keys).toEqual(NODE_KEYS);
    // The cheap failure a presence-only assertion passes: eight copies of one
    // glyph. Compare the drawn geometry, not the key attribute.
    const drawings = Array.from(icons).map((i) => i.innerHTML);
    expect(new Set(drawings).size).toBe(8);

    for (const icon of Array.from(icons)) {
      expect(icon).toHaveAttribute("aria-hidden", "true");
      expect(icon).toHaveAttribute("focusable", "false");
    }
  });

  it("ends the chain with a manifested mascot pose, not a screen-blended cut-out", async () => {
    const { container } = render(await CapabilityChain());

    const mascot = must(
      container.querySelector<HTMLImageElement>("[data-chain-mascot]"),
      "the chain mascot",
    );
    // Only files recorded in `scripts/mascot/poses.json` live in poses/, and
    // `scripts/mascot/poses.test.ts` pins that directory to the manifest, so
    // asserting the path is asserting recorded provenance (spec §5.2).
    // next/image rewrites `src` through the optimizer, so the encoded path is
    // what survives.
    expect(mascot.getAttribute("src")).toContain(encodeURIComponent(MASCOT_POSE));
    expect(mascot.getAttribute("src")).not.toContain("/renders/");
    // The pose's real alpha channel is what retired the screen-blend
    // workaround; if that class comes back the asset is being composited the
    // old, placement-constraining way (same invariant as pitch-showcase).
    expect(mascot.className).not.toContain("mix-blend");
    expect(mascot).toHaveAttribute("alt", en.chain.mascotAlt);
    // Pinned to the EXACT hint rather than "present": a wrong-but-non-empty
    // `sizes` ships a 640px+ variant to paint 160 CSS px, which is the defect
    // §2 paid 4.9s for (task 8 fix round 1).
    expect(mascot.getAttribute("sizes")).toBe(MASCOT_SIZES);
  });

  it("renders every `chain.*` string the section owns", async () => {
    render(await CapabilityChain());

    const owned = [
      en.chain.eyebrow,
      en.chain.heading,
      ...NODE_KEYS.flatMap((key) => [en.chain.nodes[key].name, en.chain.nodes[key].caption]),
    ];
    // Non-empty and the size expected: an empty list makes the loop below
    // unconditionally green (CLAUDE.md §7).
    expect(owned).toHaveLength(18);
    for (const text of owned) {
      expect(
        screen.getByText(text),
        `catalog string "${text}" must reach the DOM`,
      ).toBeInTheDocument();
    }
  });

  it("names the section's region and announces the nodes as one list", async () => {
    const { container } = render(await CapabilityChain());

    const section = must(container.querySelector("section#chain"), "the #chain section");
    expect(section).toHaveAccessibleName(en.chain.heading);

    const list = screen.getByRole("list");
    expect(screen.getAllByRole("listitem")).toHaveLength(8);
    expect(list.querySelectorAll("[data-chain-node]")).toHaveLength(8);
  });

  /**
   * I3 (review round 1). `CENTRED_HEAD` reaches into `Section`'s internals: it
   * assumes `Section`'s unsplit branch renders exactly one un-nested `h2`
   * carrying `max-w-3xl` (`section.tsx:106-116`), and overrides it from the
   * outside via a `[&_h2]:mx-auto [&_h2]:text-title` arbitrary variant. Before
   * this test, nothing asserted the outcome — only the accessible name was
   * checked above — so if `Section` ever wrapped its heading or changed its
   * tag, §6 would silently revert to a left-aligned 40px `text-display`
   * heading with a fully green suite (the same composition failure that cost
   * §2, §3 and §4 a whole rebuild task each). This vitest environment loads no
   * CSS (see `vitest.config.ts` — no stylesheet pipeline), so `getComputedStyle`
   * cannot see Tailwind's cascade; the outcome that CAN be asserted here is
   * that the centring/size override literally reaches the DOM, targeting a
   * heading that still matches `Section`'s assumption.
   */
  it("centres the head block and shrinks the heading below Section's default (I3)", async () => {
    const { container } = render(await CapabilityChain());

    const section = must(container.querySelector("section#chain"), "the #chain section");
    // The override lives on the ancestor `<section>` as a `[&_h2]` arbitrary
    // variant (Tailwind never rewrites it onto the h2's own className), so
    // this is where the outcome is actually recorded in the DOM.
    expect(section.className).toContain("[&_h2]:mx-auto");
    expect(section.className).toContain("[&_h2]:text-title");

    // The override is only meaningful if it targets exactly what Section's
    // unsplit branch is documented to render: ONE un-nested h2 carrying
    // `max-w-3xl` (the box `mx-auto` has to centre). If a future `Section`
    // change breaks either fact, this line — not just a vibe — goes red.
    const headings = section.querySelectorAll("h2");
    expect(headings).toHaveLength(1);
    const heading = must(headings[0] ?? null, "the section heading");
    expect(heading).toHaveClass("max-w-3xl");
    expect(heading).not.toHaveClass("text-heading-lg"); // the split-layout size, not this one
  });

  it("gives each of the eight nodes its own cascade step, and names the dot so it can be timed", async () => {
    const { container } = render(await CapabilityChain());

    const nodes = container.querySelectorAll("[data-chain-node]");
    expect(nodes).toHaveLength(8);

    // Each node carries its ordinal as a custom property; globals.css turns
    // that into a delay. A relationship, not an absolute literal — Rule #0
    // allows it, and it survives the grid wrapping 8 -> 4 -> 2, which a single
    // full-width sweep could not (see this component's connector docblock).
    // Read the property rather than the serialized attribute: React writes
    // `--chain-step: 0;`, and pinning that spelling would break on a formatting
    // change without anything actually regressing.
    expect(
      Array.from(nodes).map((n) =>
        (n as HTMLElement).style.getPropertyValue("--chain-step").trim(),
      ),
    ).toEqual(["0", "1", "2", "3", "4", "5", "6", "7"]);

    expect(container.querySelectorAll("[data-rail-dot]")).toHaveLength(8);
  });
});
