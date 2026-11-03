import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { WeaknessCard } from "./weakness-card";

describe("WeaknessCard", () => {
  it("renders scored rows and leaves Reading without a practice link", () => {
    render(<WeaknessCard rows={[{ family: "reading", metric: "score", score: 42, practiceHref: null }, { family: "listening", metric: "accuracy", score: 55, practiceHref: "/shadowing/v1/listening?format=typing" }]} />);
    expect(screen.getByText("Reading")).toBeInTheDocument();
    expect(screen.getByText("42%")).toBeInTheDocument();
    expect(screen.getAllByRole("meter")).toHaveLength(2);
    expect(screen.getByRole("meter", { name: "Reading" })).toHaveAttribute("value", "42");
    expect(screen.getByRole("meter", { name: "Listening (Typing)" })).toHaveAttribute("value", "55");
    expect(screen.queryByRole("link", { name: "Reading" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Listening (Typing)" })).toHaveAttribute("href", "/en/shadowing/v1/listening?format=typing");
    // The explorer lives on the Roadmap screen (Figma 64:2061); owner ruling 2026-10-13 restores the link.
    expect(screen.getByRole("link", { name: "Open weakness explorer" })).toHaveAttribute("href", "/en/roadmap");
  });

  it("names the pronunciation row by its weakest metric, never twice", () => {
    render(<WeaknessCard rows={[{ family: "pronunciation", metric: "accuracy", score: 58, practiceHref: "/shadowing/v1" }, { family: "pronunciation", metric: "pitch", score: 61, practiceHref: null }]} />);
    expect(screen.getByRole("link", { name: "Pronunciation" })).toHaveAttribute("href", "/en/shadowing/v1");
    expect(screen.getByText("Pitch accent")).toBeInTheDocument();
    expect(screen.queryByText(/Pronunciation · Pronunciation/)).not.toBeInTheDocument();
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
