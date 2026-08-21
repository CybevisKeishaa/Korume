import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/test/render";
import { PrivacyScreen } from "./privacy-screen";

const pushMock = vi.fn();
vi.mock("@/lib/i18n/navigation", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRouter: () => ({ push: pushMock }),
}));

describe("PrivacyScreen", () => {
  it("composes the AI-training toggle above the Danger Zone", () => {
    render(<PrivacyScreen />);
    expect(screen.getByText("Help improve Korume's models")).toBeInTheDocument();
    expect(screen.getByText("Control your Korume data")).toBeInTheDocument();
  });

  it("opens the delete-all-my-data dialog from the Danger Zone's erase-all row", async () => {
    render(<PrivacyScreen />);
    expect(screen.queryByLabelText("Type DELETE to confirm.")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Review deletion" }));

    expect(screen.getByLabelText("Type DELETE to confirm.")).toBeInTheDocument();
  });

  it("closes the dialog on Escape", async () => {
    render(<PrivacyScreen />);
    await userEvent.click(screen.getByRole("button", { name: "Review deletion" }));
    expect(screen.getByLabelText("Type DELETE to confirm.")).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByLabelText("Type DELETE to confirm.")).not.toBeInTheDocument();
  });

  // "Delete Account" (close_account) has no confirmation dialog in this unit
  // (see privacy-screen.tsx's file header) — reusing the erase-all dialog's
  // copy would misstate the consequence, so it routes to an honest not-built
  // destination instead, the same way the memory row's Link does.
  it("routes the close-account row to an honest not-built destination rather than the erase-all dialog", async () => {
    render(<PrivacyScreen />);

    await userEvent.click(screen.getByRole("button", { name: "Review" }));

    expect(pushMock).toHaveBeenCalledWith("/settings/privacy/close-account");
    expect(screen.queryByLabelText("Type DELETE to confirm.")).not.toBeInTheDocument();
  });
});
