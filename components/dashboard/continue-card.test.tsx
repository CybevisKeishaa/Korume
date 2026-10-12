import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { ContinueCard } from "./continue-card";

describe("ContinueCard", () => {
  it("renders a curriculum continuation with the workspace and summary destinations", () => {
    render(<ContinueCard view={{ kind: "continue", videoId: "v1", title: "At the café", placement: { title: "JLPT N5", position: 2 }, percent: 125, remainingMinutes: 4, tags: [{ kind: "jlpt", value: "N4" }, { kind: "situations", value: "daily-life" }, { kind: "sources", value: "youtube" }] }} />);
    expect(screen.getByText("JLPT N5 · Lesson 2")).toBeInTheDocument();
    expect(screen.getByText("100% completed")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "100% completed" })).toHaveAttribute("value", "100");
    expect(screen.getByText("N4")).toBeInTheDocument();
    expect(screen.getByText("Daily life")).toBeInTheDocument();
    expect(screen.getByText("YouTube")).toBeInTheDocument();
    expect(screen.queryByText(/daily-life|youtube/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue learning" })).toHaveAttribute("href", "/en/shadowing/v1");
    expect(screen.getByRole("link", { name: "Review lesson" })).toHaveAttribute("href", "/en/shadowing/v1/summary");
  });

  it("renders the onboarding state and never invents duration facts", () => {
    render(<ContinueCard view={{ kind: "onboarding" }} />);
    expect(screen.getByText("Pick a first lesson and Korume will keep your place.")).toBeInTheDocument();
    expect(screen.queryByText(/completed|video left/)).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("renders start-next and recommended states from the catalog", () => {
    const { rerender } = render(<ContinueCard view={{ kind: "startNext", videoId: "v2", title: "Next", placement: null }} />);
    expect(screen.getByText("Start next lesson")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start lesson" })).toHaveAttribute("href", "/en/shadowing/v2");
    expect(screen.queryByText(/completed|video left/)).not.toBeInTheDocument();
    rerender(<ContinueCard view={{ kind: "recommended", videoId: "v3", title: "Suggested" }} />);
    expect(screen.getByText("Recommended for you")).toBeInTheDocument();
  });

  it("accepts a structured-cloneable continue view", () => {
    expect(() => structuredClone({ kind: "startNext", videoId: "v1", title: "Cafe", placement: null, tags: [] })).not.toThrow();
  });

  it("keeps a card failure distinct from onboarding", () => {
    render(<ContinueCard error view={{ kind: "onboarding" }} />);
    expect(screen.getByText("This part couldn't load right now.")).toBeInTheDocument();
    expect(screen.queryByText("Pick a first lesson and Korume will keep your place.")).not.toBeInTheDocument();
  });
});
