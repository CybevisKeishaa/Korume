import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { SettingsSection } from "./settings-section";
import { SettingsRow } from "./settings-row";
import { SettingsIcon, type SettingsIconKey } from "./settings-icon";

const ICON_KEYS: SettingsIconKey[] = [
  "language", "goal", "schedule", "frequency", "difficulty", "scale",
  "motion", "microphone", "camera", "training", "export", "history",
];

describe("SettingsSection", () => {
  it("is a landmark named by its own heading", () => {
    render(
      <SettingsSection id="privacy" title="Privacy & Data" subtitle="Control your data.">
        <p>row</p>
      </SettingsSection>,
    );

    const section = screen.getByRole("region", { name: "Privacy & Data" });
    expect(section).toHaveAttribute("id", "privacy");
    expect(section).toHaveTextContent("Control your data.");
  });

  it("names itself from the title when it has no id", () => {
    render(
      <SettingsSection title="Appearance" subtitle="How Korume looks.">
        <p>row</p>
      </SettingsSection>,
    );
    expect(screen.getByRole("region", { name: "Appearance" })).toBeInTheDocument();
  });
});

describe("SettingsRow", () => {
  /**
   * `<label for>` pointing at a non-labelable element (a radiogroup, a group of
   * buttons) is silently ignored by browsers while reading as correct in the
   * source — an accessible-name bug that no snapshot would catch. The element
   * switching with `htmlFor` is what prevents writing one.
   */
  it("renders a real label when the control can take one", () => {
    render(
      <SettingsRow
        icon="goal"
        label="Daily Learning Goal"
        description="How long you aim to study."
        htmlFor="goal-control"
        control={<select id="goal-control" aria-label="Daily Learning Goal" />}
      />,
    );

    const label = screen.getByText("Daily Learning Goal");
    expect(label.tagName).toBe("LABEL");
    expect(label).toHaveAttribute("for", "goal-control");
  });

  it("renders a span, not a dangling label, when the control cannot take one", () => {
    render(
      <SettingsRow
        icon="difficulty"
        label="Difficulty Preference"
        description="How hard new material runs."
        control={<div role="radiogroup" aria-label="Difficulty Preference" />}
      />,
    );

    expect(screen.getByText("Difficulty Preference").tagName).toBe("SPAN");
    expect(document.querySelector("label")).toBeNull();
  });

  it("gives the description the id the caller will point aria-describedby at", () => {
    render(
      <SettingsRow
        icon="motion"
        label="Reduced Motion"
        description="Cuts animation."
        descriptionId="motion-desc"
        control={<button type="button" aria-describedby="motion-desc" />}
      />,
    );

    expect(screen.getByText("Cuts animation.")).toHaveAttribute("id", "motion-desc");
    expect(screen.getByRole("button")).toHaveAttribute("aria-describedby", "motion-desc");
  });

  it("renders what belongs under the row", () => {
    render(
      <SettingsRow icon="schedule" label="Learning Schedule" description="Which days." control={<span />}>
        <p>day picker</p>
      </SettingsRow>,
    );
    expect(screen.getByText("day picker")).toBeInTheDocument();
  });
});

describe("SettingsIcon", () => {
  // Gathered by a key list, so the list's own size is asserted (CLAUDE.md §7):
  // `it.each([])` generates zero tests and reports green.
  it("covers every row this branch draws", () => {
    expect(ICON_KEYS).toHaveLength(12);
    expect(new Set(ICON_KEYS).size).toBe(ICON_KEYS.length);
  });

  it.each(ICON_KEYS)("%s draws something and announces nothing", (name) => {
    const { container } = render(<SettingsIcon name={name} />);
    const svg = container.querySelector("svg") as SVGElement;

    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("focusable", "false");
    // An empty glyph would render an <svg> that passes every attribute check
    // above while drawing nothing at all.
    expect(svg.children.length).toBeGreaterThan(0);
    // Size comes from token classes, never from width/height attributes.
    expect(svg).not.toHaveAttribute("width");
    expect(svg.getAttribute("class")).toContain("size-icon-sm");
  });
});
