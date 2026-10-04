import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import { LessonHeaderFrame } from "./lesson-header-frame";

vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a>,
  usePathname: () => "/shadowing/v/summary",
}));

describe("LessonHeaderFrame", () => {
  it("renders back, title, eyebrow, source, JLPT, the slots in order and the mode bar — from props alone", () => {
    render(
      <LessonHeaderFrame
        videoId="v"
        backHref="/shadowing/v"
        backLabel="Back to lesson"
        title="At the café"
        eyebrow="Lesson recap"
        source="NHK · N4"
        jlptLabel="JLPT N4"
        afterTitle={<span>after-title</span>}
        actions={<span>actions</span>}
      />,
    );
    const back = screen.getByRole("link", { name: "Back to lesson" });
    expect(back.getAttribute("href")).toContain("/shadowing/v");
    expect(screen.getByRole("heading", { level: 1, name: "At the café" })).toBeInTheDocument();
    expect(screen.getByText("Lesson recap")).toBeInTheDocument();
    expect(screen.getByText("NHK · N4")).toBeInTheDocument();
    expect(screen.getByText("JLPT N4")).toBeInTheDocument();
    const header = screen.getByRole("banner");
    const text = header.textContent ?? "";
    expect(text.indexOf("after-title")).toBeLessThan(text.indexOf("actions"));
    expect(within(header).getByRole("navigation", { name: "Learning modes" })).toBeInTheDocument();
  });

  it("omits the JLPT badge, eyebrow and source when absent", () => {
    render(<LessonHeaderFrame videoId="v" backHref="/shadowing" backLabel="Back" title="T" jlptLabel={null} />);
    expect(screen.queryByText(/JLPT/)).toBeNull();
    expect(screen.getByRole("banner").querySelectorAll("p")).toHaveLength(0);
  });
});
