import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import en from "@/messages/en/profile.json";
import { PersonalGoal } from "./personal-goal";

describe("PersonalGoal", () => {
  it("quotes the goal", () => {
    render(<PersonalGoal goal="Speak naturally." />);
    expect(screen.getByText(/Speak naturally\./)).toBeInTheDocument();
    expect(screen.getByText(en.goal.caption)).toBeInTheDocument();
  });
  it("invites writing one, linking to edit, when empty", () => {
    render(<PersonalGoal goal={null} />);
    expect(screen.getByRole("link", { name: en.goal.emptyCta })).toHaveAttribute("href", expect.stringContaining("/profile/edit"));
  });
});
