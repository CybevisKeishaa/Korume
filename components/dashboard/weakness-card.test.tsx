import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { WeaknessCard } from "./weakness-card";

describe("WeaknessCard", () => {
  it("renders scored rows and leaves Reading without a practice link", () => {
    render(<WeaknessCard rows={[{ family: "reading", metric: "score", score: 42, practiceHref: null }, { family: "listening", metric: "accuracy", score: 55, practiceHref: "/shadowing/v1/dictation" }]} />);
    expect(screen.getByText("Reading · score")).toBeInTheDocument();
    expect(screen.getByText("42%")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Listening/ })).toHaveAttribute("href", "/en/shadowing/v1/dictation");
  });

  it("renders the empty state", () => {
    render(<WeaknessCard rows={[]} />);
    expect(screen.getByText("Keep learning so Korume can notice what to practise.")).toBeInTheDocument();
  });

  it("renders a local error instead of an empty snapshot", () => {
    render(<WeaknessCard rows={[]} error />);
    expect(screen.getByText("This part couldn't load right now.")).toBeInTheDocument();
  });
});
