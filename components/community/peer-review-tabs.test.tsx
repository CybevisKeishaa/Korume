import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PeerReviewTabs } from "./peer-review-tabs";

describe("PeerReviewTabs", () => {
  it("shows the queue by default and switches to mine on click", async () => {
    render(
      <PeerReviewTabs
        initialQueue={{ shares: [], nextCursor: null }}
        initialMine={[]}
      />,
    );

    expect(screen.getByText(/nothing to review/i)).toBeVisible();

    await userEvent.click(screen.getByRole("tab", { name: "Mine" }));

    expect(screen.getByText(/haven't shared/i)).toBeVisible();
  });
});
