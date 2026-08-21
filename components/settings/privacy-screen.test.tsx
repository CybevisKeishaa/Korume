import { describe, expect, it } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/test/render";
import { PrivacyScreen } from "./privacy-screen";

describe("PrivacyScreen", () => {
  it("composes the AI-training toggle above the Danger Zone, seeded with the server-read consent value", () => {
    render(<PrivacyScreen initialAiTrainingConsent />);
    expect(screen.getByText("Help improve Korume's models")).toBeInTheDocument();
    expect(screen.getByText("Control your Korume data")).toBeInTheDocument();
    expect((screen.getByRole("checkbox", { name: /Help improve Korume's models/ }) as HTMLInputElement).checked).toBe(
      true,
    );
  });

  it("opens the delete-all-my-data dialog from the Danger Zone's erase-all row", async () => {
    render(<PrivacyScreen initialAiTrainingConsent={false} />);
    expect(screen.queryByLabelText("Type DELETE to confirm.")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Review deletion" }));

    expect(screen.getByLabelText("Type DELETE to confirm.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete all my data" })).toBeInTheDocument();
  });

  it("closes the dialog on Escape", async () => {
    render(<PrivacyScreen initialAiTrainingConsent={false} />);
    await userEvent.click(screen.getByRole("button", { name: "Review deletion" }));
    expect(screen.getByLabelText("Type DELETE to confirm.")).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByLabelText("Type DELETE to confirm.")).not.toBeInTheDocument();
  });

  // Fix round 1 (2026-08-21): the close-account row now opens the SAME
  // dialog as erase-all, distinguished by tier — not a route to an unbuilt
  // page. See privacy-screen.tsx's file header for why reusing the dialog is
  // safe here (each tier carries its own, independent copy block).
  it("opens the same dialog from the Danger Zone's close-account row, with close-account copy — not the erase-all dialog's wording", async () => {
    render(<PrivacyScreen initialAiTrainingConsent={false} />);
    expect(screen.queryByLabelText("Type DELETE to confirm.")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Review" }));

    expect(screen.getByLabelText("Type DELETE to confirm.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close my account" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete all my data" })).not.toBeInTheDocument();
    expect(screen.queryByText(/will be deleted/i)).not.toBeInTheDocument();
  });

  it("does not leak state between the two rows: closing the close-account dialog and reopening erase-all shows erase-all's copy", async () => {
    render(<PrivacyScreen initialAiTrainingConsent={false} />);

    await userEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(screen.getByRole("button", { name: "Close my account" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByLabelText("Type DELETE to confirm.")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Review deletion" }));

    expect(screen.getByRole("button", { name: "Delete all my data" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close my account" })).not.toBeInTheDocument();
  });

  it("still points the memory row at an honest not-built destination — no confirmation flow exists for it in this branch", () => {
    render(<PrivacyScreen initialAiTrainingConsent={false} />);
    expect(screen.getByRole("link", { name: "Manage" })).toHaveAttribute(
      "href",
      expect.stringContaining("/settings/privacy/memory"),
    );
  });
});
