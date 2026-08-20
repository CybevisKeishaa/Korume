import { describe, expect, it } from "vitest";
import en from "./settings.json";

/**
 * Characterization pins for `settings.json`. Copy corrected from Figma
 * 337:3323 / 339:3612 per spec §2 — the frames say "cannot be undone", the
 * LOCKED lifecycle is cancelable for 7 days, and the ruling chose the
 * lifecycle. These pins are what stops the wrong sentence coming back.
 */
describe("settings.json EN — the 7-day window", () => {
  it("never claims the deletion is irreversible", () => {
    const all = JSON.stringify(en).toLowerCase();
    expect(all).not.toContain("cannot be undone");
    expect(all).not.toContain("permanently remove");
  });

  it("states the cancelable window in the dialog note", () => {
    expect(en.deleteDialog.note).toBe(
      "You have 7 days to change your mind. We keep your data untouched until then, and you can cancel any time from this page. Some records may be retained where required for legal, security, or billing purposes.",
    );
  });

  it("pins the two dialog buttons", () => {
    expect(en.deleteDialog.keep).toBe("Keep my data");
    expect(en.deleteDialog.confirm).toBe("Delete all my data");
  });

  it("pins the three Danger Zone rows", () => {
    expect(en.dangerZone.memory.title).toBe("Delete Korume Memory");
    expect(en.dangerZone.closeAccount.title).toBe("Delete Account");
    expect(en.dangerZone.eraseAll.title).toBe("Delete all my data");
  });

  it("names the consent toggle for what it actually covers", () => {
    expect(en.aiTraining.title).toBe("Help improve Korume's models");
    expect(en.aiTraining.body).toBe(
      "Let us use your recordings and learning data to improve our models. Off unless you turn it on. Your Companion remembers your learning either way — that is not model training.",
    );
  });
});
