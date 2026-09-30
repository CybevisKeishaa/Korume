import { expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { HubCourseProgress } from "./hub-course-progress";

it("reports course progress with a named accessible progressbar", () => {
  render(<HubCourseProgress total={120} completed={80} labels={{ complete: (percent) => `${percent}% complete`, lessons: (completed, total) => `${completed} / ${total} lessons` }} />);
  expect(screen.getByRole("progressbar", { name: "67% complete" })).toHaveAttribute("aria-valuenow", "67");
  expect(screen.getByText(/80 \/ 120 lessons/)).toBeInTheDocument();
});

it("renders nothing for an empty collection rather than a 0% bar", () => {
  const { container } = render(<HubCourseProgress total={0} completed={0} labels={{ complete: (percent) => `${percent}% complete`, lessons: (completed, total) => `${completed} / ${total} lessons` }} />);
  expect(container).toBeEmptyDOMElement();
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
});

it("never reports an unfinished course as 100% complete", () => {
  render(<HubCourseProgress total={200} completed={199} labels={{ complete: (percent) => `${percent}% complete`, lessons: (completed, total) => `${completed} / ${total} lessons` }} />);
  expect(screen.getByRole("progressbar", { name: "99% complete" })).toHaveAttribute("aria-valuenow", "99");
});
