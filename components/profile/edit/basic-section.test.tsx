import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/test/render";
import en from "@/messages/en/profile.json";
import { initialDraft } from "./draft";
import { makeView } from "../view-fixture";
import { BasicSection } from "./basic-section";

const copy = en.edit;
const mount = (over: Partial<Parameters<typeof BasicSection>[0]> = {}) =>
  render(
    <BasicSection draft={initialDraft(makeView().identity, "en")} set={vi.fn()} errors={{}} usernameStatus="idle" onTimeZoneBlur={vi.fn()} photo={null} {...over} />,
  );

describe("BasicSection", () => {
  it("gives every field its visible label as its accessible name", () => {
    mount();
    for (const name of [copy.fields.displayName, copy.fields.username, copy.fields.bio, copy.fields.timeZone, copy.fields.learningGoal]) {
      expect(screen.getByLabelText(name)).toBeInTheDocument();
    }
    for (const name of [copy.fields.country, copy.fields.nativeLanguage, copy.fields.targetJlpt, copy.fields.dailyGoal]) {
      expect(screen.getByRole("combobox", { name })).toBeInTheDocument();
    }
  });

  it("links an error to its field and reports typing as a patch", async () => {
    const set = vi.fn();
    mount({ set, errors: { username: copy.errors.taken } });
    const username = screen.getByLabelText(copy.fields.username);
    expect(username).toHaveAttribute("aria-invalid", "true");
    expect(document.getElementById(username.getAttribute("aria-describedby")!)).toHaveTextContent(copy.errors.taken);
    await userEvent.setup().type(screen.getByLabelText(copy.fields.bio), "!");
    expect(set).toHaveBeenCalledWith({ bio: "Learning slowly.!" });
  });

  it("lists only real countries and shows the checking hint", async () => {
    mount({ usernameStatus: "checking" });
    expect(screen.getByText(copy.username.checking)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("combobox", { name: copy.fields.country }));
    expect((await screen.findAllByRole("option")).length).toBe(250); // 249 codes + "Not set"
  });
});
