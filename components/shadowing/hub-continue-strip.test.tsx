import { expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { HubContinueStrip } from "./hub-continue-strip";

it("links the complete resume summary to its lesson", () => {
  render(<HubContinueStrip course="Everyday Conversation" lesson={{ id: "v2", title: "Second" }} index={2} percent={17} labels={{ eyebrow: "CONTINUE WHERE YOU LEFT OFF", lesson: (index) => `Lesson ${index}`, percent: (percent) => `${percent}%` }} />);
  // The visible summary IS the accessible name (WCAG 2.5.3): no aria-label overrides it.
  expect(screen.getByRole("link", { name: /Everyday Conversation · Lesson 2 · Second/ })).toHaveAttribute("href", "/en/shadowing/v2");
  expect(screen.getByText("Everyday Conversation · Lesson 2 · Second")).toBeInTheDocument();
});
