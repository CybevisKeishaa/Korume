import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/test/render";
import en from "@/messages/en/profile.json";
import { PREFERRED_PRACTICES } from "@/lib/profile/practices";
import { initialDraft } from "./draft";
import { makeView } from "../view-fixture";
import { PreferencesSection } from "./preferences-section";

const copy = en.edit;
const draft = () => initialDraft(makeView().identity, "en");

describe("PreferencesSection", () => {
  it("labels the three selects and offers every closed practice as a toggle", () => {
    render(<PreferencesSection draft={draft()} set={vi.fn()} />);
    for (const name of [copy.fields.interfaceLanguage, copy.fields.subtitleStyle, copy.fields.defaultFurigana]) {
      expect(screen.getByRole("combobox", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("group", { name: copy.fields.preferredPractice })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(PREFERRED_PRACTICES.length);
    expect(screen.getByRole("button", { name: copy.practice.shadowing })).toHaveAttribute("aria-pressed", "true");
  });

  it("reports a toggled practice in catalog order", async () => {
    const set = vi.fn();
    render(<PreferencesSection draft={draft()} set={set} />);
    await userEvent.setup().click(screen.getByRole("button", { name: copy.practice.listening }));
    expect(set).toHaveBeenCalledWith({ preferredPractices: ["shadowing", "listening"] });
  });
});
