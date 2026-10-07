import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import en from "@/messages/en/profile.json";
import { FavoriteContent } from "./favorite-content";

describe("FavoriteContent", () => {
  it("renders chips in the given order and skips unknown sources", () => {
    render(<FavoriteContent sources={["nhk", "bogus", "anime"]} />);
    expect(screen.getAllByRole("listitem").map((n) => n.textContent)).toEqual(["NHK", "Anime"]);
  });
  it("shows the empty state for null (not enough evidence) and for all-unknown", () => {
    const { rerender } = render(<FavoriteContent sources={null} />);
    expect(screen.getByText(en.favorite.empty)).toBeInTheDocument();
    rerender(<FavoriteContent sources={["bogus"]} />);
    expect(screen.getByText(en.favorite.empty)).toBeInTheDocument();
  });
});
