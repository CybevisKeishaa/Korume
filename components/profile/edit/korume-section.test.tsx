import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/test/render";
import en from "@/messages/en/profile.json";
import { initialDraft } from "./draft";
import { makeView } from "../view-fixture";
import { KorumeSection } from "./korume-section";

describe("KorumeSection", () => {
  it("is one Show Korume switch that reports the flipped value", async () => {
    const set = vi.fn();
    render(<KorumeSection draft={initialDraft(makeView().identity, "en")} set={set} />);
    const toggle = screen.getByRole("switch", { name: en.edit.fields.showKorume });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(screen.getAllByRole("switch")).toHaveLength(1);
    await userEvent.setup().click(toggle);
    expect(set).toHaveBeenCalledWith({ companionEnabled: false });
  });
});
