import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TranslationDisclosure } from "./translation-disclosure";

describe("TranslationDisclosure", () => {
  it("is collapsed by default and reveals the translation when opened", async () => {
    render(<TranslationDisclosure translation="This is the translation." />);

    expect(screen.queryByText("This is the translation.")).not.toBeVisible();

    await userEvent.click(screen.getByText("Show translation"));

    expect(screen.getByText("This is the translation.")).toBeVisible();
  });

  it("renders nothing when there is no translation", () => {
    const { container } = render(<TranslationDisclosure translation={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
