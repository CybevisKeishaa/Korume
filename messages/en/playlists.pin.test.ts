import { describe, expect, it } from "vitest";
import en from "./playlists.json";

/**
 * Characterization test for `playlists.json` (Task 16): a literal `toBe` pin
 * for every `playlists.*` leaf, copied verbatim from the pre-extraction
 * source of `app/[locale]/(app)/playlists/{page,[id]/page}.tsx` and
 * `components/community/{playlist-composer,playlist-detail,playlist-list,
 * playlists-page,public-playlist-list,save-to-playlist-button}.tsx` on
 * `layer-9a-string-extraction` before Task 16 (never derived from the
 * catalog itself — binding pattern 2).
 *
 * Playlist names/descriptions the user typed are CONTENT (spec D8) and never
 * appear in this catalog — only the surrounding chrome is pinned here.
 * `save-to-playlist-button.tsx` lives at `components/community/` by path but
 * translates from THIS namespace (Task 16 dependency-graph audit: it's also
 * consumed by the `videos` surface, and ownership follows the feature).
 */
describe("playlists.json EN — playlists/page.tsx", () => {
  it("pins the heading and subtitle", () => {
    expect(en.page.heading).toBe("Playlists");
    expect(en.page.subtitle).toBe(
      "Organize videos into a study playlist, or browse what other learners have made public.",
    );
  });
});

describe("playlists.json EN — playlists/[id]/page.tsx", () => {
  it("pins the back-to-playlists link", () => {
    expect(en.detailPage.back).toBe("← Back to playlists");
  });
});

describe("playlists.json EN — playlists-page.tsx", () => {
  it("pins the tablist's accessible name, the two tab labels, and the new-playlist toggle", () => {
    expect(en.tabs.ariaLabel).toBe("Playlists");
    expect(en.tabs.mine).toBe("My playlists");
    expect(en.tabs.public).toBe("Browse public");
    expect(en.tabs.newPlaylist).toBe("New playlist");
  });
});

describe("playlists.json EN — playlist-composer.tsx", () => {
  it("pins the field labels and the submit-button states", () => {
    expect(en.composer.nameLabel).toBe("Name");
    expect(en.composer.descriptionLabel).toBe("Description (optional)");
    expect(en.composer.create).toBe("Create playlist");
    expect(en.composer.creating).toBe("Creating…");
  });

  it("pins the 429 and generic create-error messages", () => {
    expect(en.composer.tooManyWithSeconds).toBe("Too many playlists — try again in {seconds}s.");
    expect(en.composer.tooManyGeneric).toBe("Too many playlists — please wait a moment and try again.");
    expect(en.composer.createError).toBe("Couldn't create your playlist — please try again.");
  });
});

describe("playlists.json EN — shared 'Deleted user'/'By {name}'/item-count leaves (playlist-detail + public-playlist-list)", () => {
  it("pins the deleted-owner fallback, the owner-attribution template, and the item-count plural", () => {
    expect(en.deletedUser).toBe("Deleted user");
    expect(en.byOwner).toBe("By {name}");
    expect(en.itemCount).toBe("{count, plural, one {{count} video} other {{count} videos}}");
  });
});

describe("playlists.json EN — playlist-detail.tsx", () => {
  it("pins the public/private badge text and the empty-playlist state", () => {
    expect(en.detail.public).toBe("Public");
    expect(en.detail.private).toBe("Private");
    expect(en.detail.empty).toBe("No videos in this playlist yet.");
  });

  it("pins the reorder/remove controls, paired with their accessible-name templates", () => {
    expect(en.detail.moveUp).toBe("Move up");
    expect(en.detail.moveUpAriaLabel).toBe("Move up: {title}");
    expect(en.detail.moveDown).toBe("Move down");
    expect(en.detail.moveDownAriaLabel).toBe("Move down: {title}");
    expect(en.detail.remove).toBe("Remove");
  });

  it("pins the remove/reorder error fallbacks", () => {
    expect(en.detail.removeError).toBe("Couldn't remove that video — please try again.");
    expect(en.detail.reorderError).toBe("Couldn't reorder — please try again.");
  });
});

describe("playlists.json EN — playlist-list.tsx", () => {
  it("pins the description field label, edit control, and delete-confirm copy", () => {
    expect(en.list.descriptionLabel).toBe("Description");
    expect(en.list.edit).toBe("Edit");
    expect(en.list.deleteConfirm).toBe("Delete this playlist? This can't be undone.");
  });

  it("precisely pins the public-toggle's accessible label and its visibility-consequence explanation (privacy-adjacent surface)", () => {
    expect(en.list.makePublicAriaLabel).toBe("Make public");
    expect(en.list.publicLabel).toBe("Public");
    expect(en.list.publicDescription).toBe("Public playlists are visible to all signed-in users.");
  });

  it("pins the empty state and the rate-limit/save-error messages (short generic form — no 'and try again')", () => {
    expect(en.list.empty).toBe("No playlists yet — create one to start organizing videos.");
    expect(en.list.tooManyWithSeconds).toBe("Too many requests — try again in {seconds}s.");
    expect(en.list.tooManyGeneric).toBe("Too many requests — please wait a moment.");
    expect(en.list.saveError).toBe("Couldn't save your changes — please try again.");
  });
});

describe("playlists.json EN — public-playlist-list.tsx", () => {
  it("pins the empty state and the load-more-error message", () => {
    expect(en.publicList.empty).toBe("No public playlists yet.");
    expect(en.publicList.loadMoreError).toBe("Couldn't load more — please try again.");
  });
});

describe("playlists.json EN — save-to-playlist-button.tsx", () => {
  it("pins the trigger/popover label and the lazy-load states", () => {
    expect(en.saveButton.trigger).toBe("Save to playlist");
    expect(en.saveButton.loadingPlaylists).toBe("Loading your playlists…");
    expect(en.saveButton.loadListError).toBe("Couldn't load your playlists.");
  });

  it("pins the already-in-playlist (409), rate-limit (short generic form), and add/create error messages", () => {
    expect(en.saveButton.alreadyInPlaylist).toBe("This video is already in that playlist.");
    expect(en.saveButton.tooManyWithSeconds).toBe("Too many requests — try again in {seconds}s.");
    expect(en.saveButton.tooManyGeneric).toBe("Too many requests — please wait a moment.");
    expect(en.saveButton.addError).toBe("Couldn't add this video — please try again.");
    expect(en.saveButton.createError).toBe("Couldn't create that playlist — please try again.");
  });

  it("pins the quick-create field label/placeholder, the Create & add button, and the added confirmation", () => {
    expect(en.saveButton.newPlaylistNameLabel).toBe("New playlist name");
    expect(en.saveButton.createAndAdd).toBe("Create & add");
    expect(en.saveButton.added).toBe("Added to playlist.");
  });
});
