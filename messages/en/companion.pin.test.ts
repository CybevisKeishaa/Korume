import { describe, expect, it } from "vitest";
import en from "./companion.json";
import vi from "../vi/companion.json";

/**
 * Characterization test for `companion.json` (Task 17). Unlike every other
 * `*.pin.test.ts` in this plan, there is no PRE-extraction JSX source to pin
 * against: `memoryTitleFor`'s descriptor keys never existed as hardcoded EN
 * strings anywhere in the app (the old `titleFor()` in `lib/companion/dedupe.ts`
 * only ever returned Vietnamese copy — see `docs/superpowers/plans/
 * 2026-07-19-l9a-string-extraction-vietnamese.md`, Task 17). So this pins the
 * catalog leaves literally, against the plan's own authored EN strings —
 * the plan IS the source of truth here, not a refactored component.
 *
 * There is no Journal UI yet (L9b) — this namespace has zero UI consumers at
 * ship; `dedupe.test.ts` is what actually exercises `memoryTitleFor()`.
 *
 * P12 regression guard (spec: "never called 'stage' — that imports a
 * game/levelling mindset P12 rejects"): none of the four `companionGrew`
 * phrasings may contain a bare digit exposing the phase number to the
 * learner (the OLD `titleFor` did: "...bước sang giai đoạn 2").
 */
describe("companion.json EN — memoryTitleFor descriptors (spec §4.4)", () => {
  it("pins the four once-in-a-lifetime discovered-memory titles", () => {
    expect(en.memoryTitle.firstShadow).toBe("The first line you shadowed successfully.");
    expect(en.memoryTitle.lineMastered).toBe("The line you practiced until you could finally say it.");
    expect(en.memoryTitle.miningSaved).toBe("A line you decided to save.");
    expect(en.memoryTitle.firstVideoCompleted).toBe("The first video you finished.");
    expect(en.memoryTitle.firstMeeting).toBe("The day the two of you met.");
  });

  it("pins the jlptPassed template with its {level} placeholder", () => {
    expect(en.memoryTitle.jlptPassed).toBe("JLPT {level} milestone");
  });

  it("pins all four companionGrew phasings, keyed by phase", () => {
    expect(en.memoryTitle.companionGrew["1"]).toBe("The day the two of you met.");
    expect(en.memoryTitle.companionGrew["2"]).toBe("The day your companion started to feel closer.");
    expect(en.memoryTitle.companionGrew["3"]).toBe("The day your companion truly came to understand you.");
    expect(en.memoryTitle.companionGrew["4"]).toBe(
      "The day your companion had been with you long enough to remember the whole journey.",
    );
  });

  it("P12 guard: no companionGrew phrasing contains a bare digit-as-stage", () => {
    for (const phrase of Object.values(en.memoryTitle.companionGrew)) {
      expect(phrase).not.toMatch(/\d/);
    }
  });
});

/**
 * The Companion's speech templates (L9b Presence, Task 7). Same situation as
 * `memoryTitle` above: these strings never existed as hardcoded JSX, so the
 * plan is the source of truth and the pins are literal.
 *
 * `speechKeyFor` (lib/companion/presence/speech.ts) returns exactly these four
 * keys as a literal union, so the mapping is type-checked; these pins are what
 * stop the COPY drifting from the authored voice underneath it.
 */
describe("companion.json EN — speech templates (spec 1 §5.12)", () => {
  it("pins the four ambient address templates", () => {
    expect(en.speech.finishedShadowing).toBe("Another line has become part of your journey.");
    expect(en.speech.memoryCreated).toBe("That moment is safe in the journal now.");
    expect(en.speech.emptyLibrary).toBe("The first video you bring here will start a new chapter.");
    expect(en.speech.emptyMiningDeck).toBe("Lines you save will gather here, ready to be remembered.");
  });

  it("pins the two a11y labels the ambient shell renders", () => {
    expect(en.a11y.sprite).toBe("Your companion — open the journal");
    expect(en.a11y.dismissSpeech).toBe("Dismiss");
  });

  /**
   * Copy rule D9 (binding): every Companion line looks FORWARD and never
   * apologizes for the present. The two "empty state" contexts are where that
   * rule is easiest to break — `empty_library` must not say "you have no
   * videos yet". Guarded as a rule, not just as a pin, so a future rewrite
   * that legitimately changes the wording still cannot reintroduce the
   * apology.
   */
  it("D9 guard: no speech template apologizes for an empty present", () => {
    for (const line of Object.values(en.speech)) {
      expect(line).not.toMatch(/\b(no|none|nothing|empty|yet|sorry)\b/i);
    }
  });
});

/**
 * The Journal surface's own copy (L9b Presence, Task 10). Same situation as
 * the blocks above: authored in the plan, never extracted from JSX, so the
 * pins are literal.
 *
 * `empty` carries the D9 rule the whole surface is judged on — the Journal a
 * learner opens on day one is EMPTY, and that first impression must look
 * forward ("the first page is waiting") rather than apologize for having
 * nothing in it. Guarded as a rule below, not only as a pin, so a legitimate
 * rewrite still cannot reintroduce the apology.
 */
describe("companion.json EN — Journal surface (spec §5)", () => {
  it("pins the Journal's chrome and per-memory affordances", () => {
    expect(en.journal.metaTitle).toBe("Journal");
    expect(en.journal.title).toBe("Journal");
    expect(en.journal.returnToMoment).toBe("Return to this moment");
    expect(en.journal.giftedMarker).toBe("A memory you gifted");
    expect(en.journal.discoveredMarker).toBe("A memory discovered along the way");
    expect(en.journal.untitledGifted).toBe("A line you kept.");
  });

  it("pins the forward-looking empty state", () => {
    expect(en.journal.empty).toBe(
      "The first page is waiting for the stories we'll discover together.",
    );
  });

  it("D9 guard: the empty state never apologizes for an empty present", () => {
    expect(en.journal.empty).not.toMatch(/\b(no|none|nothing|empty|yet|sorry)\b/i);
  });
});

/**
 * The gifted-pin control's copy (L9b Presence, Task 11) — the affordance that
 * lets a learner keep a transcript line from shadowing or dictation. Authored
 * in the plan like the blocks above, so the pins are literal.
 *
 * `tooMany` is the 429 surface. Spec §5 boundary: this is ORDINARY learner UI
 * (the learner writing in their own book), not the Companion speaking — but
 * the voice still may not scold, so it is guarded as a rule below and not only
 * pinned. The failure copy the learner sees for every other failure mode comes
 * from `common.errors.network` (a +1 consumer for this surface), never from a
 * server diagnostic (convention #4).
 */
describe("companion.json EN — gifted-pin control (spec D6)", () => {
  it("pins the pin control's trigger, dialog and note affordances", () => {
    expect(en.pin.trigger).toBe("Pin to journal");
    expect(en.pin.dialogTitle).toBe("Keep this line in your journal");
    expect(en.pin.noteLabel).toBe("A few words of your own (optional)");
  });

  it("pins the four outcome messages", () => {
    expect(en.pin.success).toBe("Kept. It's in your journal now.");
    expect(en.pin.alreadyKept).toBe("You already kept this line — a saved note can't be changed.");
    expect(en.pin.tooMany).toBe(
      "You're pinning fast — take a breath and try again shortly.",
    );
    expect(en.pin.signedOut).toBe("You've been signed out. Please log in again to keep this.");
  });

  it("voice guard: the rate-limit message never blames or forbids the learner", () => {
    expect(en.pin.tooMany).not.toMatch(/\b(too many|stop|don't|error|denied|limit)\b/i);
  });
});

describe("companion.json VI — gifted-pin control (primary learner locale)", () => {
  it("pins the pin control's trigger, dialog and note affordances", () => {
    expect(vi.pin.trigger).toBe("Giữ lại trong nhật ký");
    expect(vi.pin.dialogTitle).toBe("Giữ câu này lại nhé?");
    expect(vi.pin.noteLabel).toBe("Đôi lời của riêng bạn (tùy chọn)");
  });

  it("pins the four outcome messages", () => {
    expect(vi.pin.success).toBe("Được rồi. Mình đã giữ câu này lại cho bạn.");
    expect(vi.pin.alreadyKept).toBe(
      "Câu này đã được giữ lại rồi. Ghi chú cũng đã nằm yên ở đó nhé.",
    );
    expect(vi.pin.tooMany).toBe(
      "Từ từ thôi nào. Bạn đang giữ lại hơi nhiều rồi đó — nghỉ một chút rồi quay lại nhé.",
    );
    expect(vi.pin.signedOut).toBe(
      "Hình như bạn vừa đăng xuất rồi. Đăng nhập lại nhé, mình sẽ giữ câu này cho bạn.",
    );
  });
});

describe("companion.json VI — speech templates (primary learner locale)", () => {
  it("pins the four ambient address templates", () => {
    expect(vi.speech.finishedShadowing).toBe(
      "Thêm một câu nữa nhé. Vậy là nó đã thuộc về hành trình của bạn rồi.",
    );
    expect(vi.speech.memoryCreated).toBe(
      "Ừm, câu này đáng được giữ lại. Mình đã cất nó vào nhật ký rồi.",
    );
    expect(vi.speech.emptyLibrary).toBe(
      "Khi bạn mang video đầu tiên về đây, mình sẽ ở đây để cùng bạn bắt đầu.",
    );
    expect(vi.speech.emptyMiningDeck).toBe(
      "Những câu bạn giữ lại sẽ tụ về đây. Đến lúc gặp lại chúng, đừng giả vờ là không nhớ nhé.",
    );
  });

  it("pins the two a11y labels", () => {
    // A15 — the companion's Vietnamese name is "Linh thú". This label is the
    // ONLY shipped VN string that named the creature; the speech, journal and
    // memoryTitle catalogs speak in first person ("mình") and never name it.
    expect(vi.a11y.sprite).toBe("Linh thú của bạn — mở nhật ký");
    expect(vi.a11y.dismissSpeech).toBe("Đóng lời nhắn");
  });

  /** D9 in Vietnamese: "chưa có" / "không có" is the apology to avoid. */
  it("D9 guard: no speech template apologizes for an empty present", () => {
    for (const line of Object.values(vi.speech)) {
      expect(line).not.toMatch(/chưa có|không có|trống/i);
    }
  });
});

/**
 * The P12 guard must hold on the PRIMARY LEARNER LOCALE too, not just EN.
 * VI `companionGrew` copy is what actually ships to the learner, and the
 * original P12 violation lived in Vietnamese ("...bước sang giai đoạn 2").
 * An EN-only guard would not fail if a future VI edit reintroduced a stage
 * digit — so guard VI explicitly. (Pins are EN-only by convention, with one
 * exception below: `firstMeeting` is VI-pinned too.
 *
 * That exception's ORIGINAL reason was that the VI copy was deliberately
 * distinct from `companionGrew.1`. As of the 2026-08-08 native-speaker rewrite
 * it no longer is — both now read "Ngày chúng ta gặp nhau.", which matches what
 * EN has always done ("The day the two of you met." in both). The pin is kept
 * anyway, on a different and still-valid rationale: two keys holding the same
 * string by intent need a literal pin each, or a rewrite of one silently drags
 * the other along unnoticed.)
 */
/**
 * VI `memoryTitle`'s non-`companionGrew` leaves (Task 13 mutation check): the
 * P12 guard below only ever inspects `companionGrew`, so the other five
 * `memoryTitle` leaves had no literal VI pin and no test caught an append/
 * punctuation mutation on them — a real catalog-mutation gap on the primary
 * learner locale, confirmed by manual mutation during whole-branch
 * verification. Pinned literally here to close it, mirroring the EN block.
 */
describe("companion.json VI — memoryTitle descriptors (primary learner locale)", () => {
  it("pins the once-in-a-lifetime discovered-memory titles", () => {
    expect(vi.memoryTitle.firstShadow).toBe("Câu thoại đầu tiên bạn shadowing được.");
    expect(vi.memoryTitle.lineMastered).toBe("Câu bạn luyện mãi, rồi cuối cùng cũng nói được.");
    expect(vi.memoryTitle.miningSaved).toBe("Câu bạn nghe xong và quyết định giữ lại.");
    expect(vi.memoryTitle.firstVideoCompleted).toBe("Video đầu tiên bạn cùng mình đi hết.");
  });

  it("pins the jlptPassed template with its {level} placeholder", () => {
    expect(vi.memoryTitle.jlptPassed).toBe("Cột mốc JLPT {level}");
  });
});

describe("companion.json VI — P12 stage-number guard (primary learner locale)", () => {
  it("no companionGrew phrasing contains a bare digit-as-stage", () => {
    for (const phrase of Object.values(vi.memoryTitle.companionGrew)) {
      expect(phrase).not.toMatch(/\d/);
    }
  });

  it("pins the firstMeeting phrasing", () => {
    expect(vi.memoryTitle.firstMeeting).toBe("Ngày chúng ta gặp nhau.");
  });

  /**
   * Task 13 mutation check: the digit guard above only catches a mutation
   * that inserts a bare digit — an append/punctuation mutation to any of the
   * four phasings survived every other test (confirmed by manual mutation
   * during whole-branch verification). Literal pins close that gap, same as
   * the EN block already does for its own companionGrew phasings.
   */
  it("pins all four companionGrew phasings, keyed by phase", () => {
    expect(vi.memoryTitle.companionGrew["1"]).toBe("Ngày chúng ta gặp nhau.");
    expect(vi.memoryTitle.companionGrew["2"]).toBe("Ngày mình bắt đầu hiểu bạn hơn một chút.");
    expect(vi.memoryTitle.companionGrew["3"]).toBe("Ngày mình thật sự hiểu cách bạn học.");
    expect(vi.memoryTitle.companionGrew["4"]).toBe(
      "Ngày mình đã đi cùng bạn đủ lâu để nhớ cả một chặng đường.",
    );
  });
});

/**
 * The Journal is the one Companion surface a learner reads at length, so its
 * VI copy — what actually ships to this product's primary audience — is
 * pinned in full rather than left to the EN pins plus a key-set check.
 */
describe("companion.json VI — Journal surface (primary learner locale)", () => {
  it("pins the Journal's chrome and per-memory affordances", () => {
    expect(vi.journal.metaTitle).toBe("Nhật ký");
    expect(vi.journal.title).toBe("Nhật ký");
    expect(vi.journal.returnToMoment).toBe("Quay lại khoảnh khắc này");
    expect(vi.journal.giftedMarker).toBe("Ký ức bạn trao lại cho mình");
    expect(vi.journal.discoveredMarker).toBe("Ký ức mình cùng bạn tìm thấy trên đường đi");
    expect(vi.journal.untitledGifted).toBe("Một câu thoại bạn đã quyết định giữ lại.");
  });

  it("pins the forward-looking empty state", () => {
    expect(vi.journal.empty).toBe(
      "Từ hôm nay, mình cùng bắt đầu viết những trang đầu tiên nhé.",
    );
  });

  /** D9 in Vietnamese: "chưa có" / "không có" / "trống" is the apology to avoid. */
  it("D9 guard: the empty state never apologizes for an empty present", () => {
    expect(vi.journal.empty).not.toMatch(/chưa có|không có|trống/i);
  });
});
