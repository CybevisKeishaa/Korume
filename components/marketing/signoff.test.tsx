import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { Signoff } from "./signoff";
import en from "@/messages/en/marketing.json";

describe("Signoff", () => {
  it("renders the frame-only sign-off the user ruled authoritative", async () => {
    render(await Signoff());

    // Spec §11 ruling 4: §9 exists in the frame and not in the reference, and the
    // frame wins. Its WORDING is still the owner's — the plan's test typed
    // "A quieter way to keep going." and the catalog now says "A gentler way to
    // keep going." — so the heading is derived, not retyped.
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(en.signoff.heading);
    expect(screen.getByText(en.signoff.body)).toBeInTheDocument();
  });

  it("closes the page quietly rather than repeating §8's call to action", async () => {
    const { container } = render(await Signoff());

    // The one thing §9 must NOT become is a second CTA: §8 sits directly above it
    // with the page's only two actions. A link appearing here would split them.
    // Note this is about ACTIONS, not alignment — §9 is centred like §8, and the
    // absence of buttons is what keeps the two from competing.
    expect(container.querySelectorAll("a")).toHaveLength(0);
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });

  it("does not out-shout the call to action directly above it", async () => {
    render(await Signoff());

    // ⚠️ Built `stacked` first, which is what `Section` defaults to and what the
    // plan asked for. Rendered, that gave §9 a `text-display` (40px) heading over
    // §8's `text-title` (28px) — the page's quietest section louder than its
    // loudest, and §9 the only stacked section on a page of splits. This pins the
    // fix so a later refactor cannot quietly restore the default.
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading.className).toContain("text-title");
    expect(heading.className).not.toContain("text-display");
  });
});
