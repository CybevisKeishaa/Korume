import { describe, expect, it } from "vitest";
import en from "./admin.json";

/**
 * Characterization test for `admin.json` (Task 17): a literal `toBe` pin for
 * every `admin.*` leaf that has a real pre-extraction English source, copied
 * verbatim from `components/admin/*`, `components/style-guide/*`, and
 * `app/[locale]/(admin)/admin/**` on `layer-9a-string-extraction` before
 * Task 17 (never derived from the catalog itself — binding pattern 2).
 *
 * `content.fields.*.helpText` is intentionally NOT pinned here — those
 * strings stay plain hardcoded JSON-shape documentation in
 * `content-fields.ts` (D8: technical schema notation, not chrome), never
 * routed through the catalog at all, so there is nothing to pin.
 */
describe("admin.json EN — admin-shell.tsx", () => {
  it("pins the tagline, nav labels, and back-to-app link", () => {
    expect(en.shell.tagline).toBe("Admin CMS");
    expect(en.shell.nav.dashboard).toBe("Dashboard");
    expect(en.shell.nav.videos).toBe("Video queue");
    expect(en.shell.nav.content).toBe("Content");
    expect(en.shell.nav.styleGuide).toBe("Style guide");
    expect(en.shell.backToApp).toBe("Back to app");
    expect(en.shell.navAria).toBe("Admin");
  });
});

describe("admin.json EN — admin/page.tsx + stats-dashboard.tsx", () => {
  it("pins the dashboard page heading and subtitle", () => {
    expect(en.dashboard.heading).toBe("Dashboard");
    expect(en.dashboard.subtitle).toBe("Users, retention and content at a glance.");
  });

  it("pins the loading and error states", () => {
    expect(en.dashboard.loading).toBe("Loading stats…");
    expect(en.dashboard.error).toBe("Could not load the stats dashboard.");
  });

  it("pins the three section headings", () => {
    expect(en.dashboard.sections.users).toBe("Users");
    expect(en.dashboard.sections.retention).toBe("Retention");
    expect(en.dashboard.sections.content).toBe("Content");
    expect(en.dashboard.sections.activity).toBe("Top activity (last 7 days)");
  });

  it("pins the five user stat card labels", () => {
    expect(en.dashboard.stats.totalUsers).toBe("Total users");
    expect(en.dashboard.stats.new7d).toBe("New (7d)");
    expect(en.dashboard.stats.new30d).toBe("New (30d)");
    expect(en.dashboard.stats.active7d).toBe("Active (7d)");
    expect(en.dashboard.stats.active30d).toBe("Active (30d)");
  });

  it("pins the retention no-cohort fallback and summary template", () => {
    expect(en.dashboard.retention.noCohortData).toBe("No cohort data yet");
    expect(en.dashboard.retention.summary).toBe(
      "{activeCount} of {cohortSize} in cohort still active in the last 7 days.",
    );
  });

  it("pins the seven content-count stat labels", () => {
    expect(en.dashboard.contentCounts.videosPending).toBe("Videos pending");
    expect(en.dashboard.contentCounts.videosApproved).toBe("Videos approved");
    expect(en.dashboard.contentCounts.kanji).toBe("Kanji");
    expect(en.dashboard.contentCounts.vocab).toBe("Vocabulary");
    expect(en.dashboard.contentCounts.grammar).toBe("Grammar points");
    expect(en.dashboard.contentCounts.jlptTests).toBe("JLPT tests");
    expect(en.dashboard.contentCounts.readingPassages).toBe("Reading passages");
  });

  it("pins the activity empty state and the generated-at template", () => {
    expect(en.dashboard.activityEmpty).toBe("No activity recorded yet.");
    expect(en.dashboard.generatedAt).toBe("Generated {date}");
  });
});

describe("admin.json EN — admin/content/page.tsx + content-type-cards.tsx", () => {
  it("pins the content landing heading and subtitle", () => {
    expect(en.content.landing.heading).toBe("Content");
    expect(en.content.landing.subtitle).toBe("Pick a content type to manage.");
  });

  it("pins each content type's label and description", () => {
    expect(en.content.types.kanji.label).toBe("Kanji");
    expect(en.content.types.kanji.description).toBe(
      "Characters, readings, meanings, mnemonics and stroke order.",
    );
    expect(en.content.types.vocab.label).toBe("Vocabulary");
    expect(en.content.types.vocab.description).toBe("Words, readings and meanings by JLPT level.");
    expect(en.content.types.grammar.label).toBe("Grammar");
    expect(en.content.types.grammar.description).toBe(
      "Grammar points, explanations and example sentences.",
    );
    expect(en.content.types.jlpt_tests.label).toBe("JLPT Tests");
    expect(en.content.types.jlpt_tests.description).toBe("Full JLPT mock tests with nested questions.");
    expect(en.content.types.reading_passages.label).toBe("Reading Passages");
    expect(en.content.types.reading_passages.description).toBe(
      "Reading comprehension passages with questions.",
    );
  });

  it("pins each content type's search label", () => {
    expect(en.content.types.kanji.searchLabel).toBe("Search by character");
    expect(en.content.types.vocab.searchLabel).toBe("Search by word");
    expect(en.content.types.grammar.searchLabel).toBe("Search by title");
    expect(en.content.types.jlpt_tests.searchLabel).toBe("Search by title");
    expect(en.content.types.reading_passages.searchLabel).toBe("Search by title");
  });
});

describe("admin.json EN — content-fields.ts field labels (content-form.tsx consumer)", () => {
  it("pins kanji's field labels", () => {
    expect(en.content.fields.kanji.character.label).toBe("Character");
    expect(en.content.fields.kanji.jlpt_level.label).toBe("JLPT level");
    expect(en.content.fields.kanji.stroke_count.label).toBe("Stroke count");
    expect(en.content.fields.kanji.radical_id.label).toBe("Radical ID (uuid)");
    expect(en.content.fields.kanji.meaning_en.label).toBe("Meaning (EN)");
    expect(en.content.fields.kanji.meaning_vi.label).toBe("Meaning (VI)");
    expect(en.content.fields.kanji.mnemonic_text.label).toBe("Mnemonic");
    expect(en.content.fields.kanji.mnemonic_image_url.label).toBe("Mnemonic image URL");
    expect(en.content.fields.kanji.stroke_order_svg.label).toBe("Stroke order SVG");
    expect(en.content.fields.kanji.readings.label).toBe("Readings (JSON)");
  });

  it("pins vocab's field labels", () => {
    expect(en.content.fields.vocab.word.label).toBe("Word");
    expect(en.content.fields.vocab.reading.label).toBe("Reading");
    expect(en.content.fields.vocab.jlpt_level.label).toBe("JLPT level");
    expect(en.content.fields.vocab.audio_url.label).toBe("Audio URL");
    expect(en.content.fields.vocab.part_of_speech.label).toBe("Part of speech");
  });

  it("pins grammar's field labels", () => {
    expect(en.content.fields.grammar.title.label).toBe("Title");
    expect(en.content.fields.grammar.explanation.label).toBe("Explanation");
    expect(en.content.fields.grammar.structure_pattern.label).toBe("Structure pattern");
    expect(en.content.fields.grammar.example_sentences.label).toBe("Example sentences (JSON)");
  });

  it("pins jlpt_tests's field labels (note: 'level', not 'jlpt_level')", () => {
    expect(en.content.fields.jlpt_tests.level.label).toBe("JLPT level");
    expect(en.content.fields.jlpt_tests.title.label).toBe("Title");
    expect(en.content.fields.jlpt_tests.section_config.label).toBe("Section config (JSON object)");
    expect(en.content.fields.jlpt_tests.questions.label).toBe("Questions (JSON)");
  });

  it("pins reading_passages's field labels", () => {
    expect(en.content.fields.reading_passages.title.label).toBe("Title");
    expect(en.content.fields.reading_passages.body_jp.label).toBe("Body (Japanese)");
    expect(en.content.fields.reading_passages.body_translation.label).toBe("Body (translation)");
    expect(en.content.fields.reading_passages.word_count.label).toBe("Word count");
    expect(en.content.fields.reading_passages.questions.label).toBe("Questions (JSON)");
  });
});

describe("admin.json EN — content-manager.tsx", () => {
  it("pins the columns, search/import/add controls, and CSV import panel", () => {
    expect(en.content.columns.created).toBe("Created");
    expect(en.content.columns.actions).toBe("Actions");
    expect(en.content.manager.search).toBe("Search");
    expect(en.content.manager.importCsv).toBe("Import CSV");
    expect(en.content.manager.add).toBe("Add {type}");
    expect(en.content.manager.pasteCsvLabel).toBe(
      "Paste CSV (header row + up to 500 data rows, max ~1MB)",
    );
    expect(en.content.manager.uploading).toBe("Uploading…");
    expect(en.content.manager.upload).toBe("Upload");
  });

  it("pins the CSV import result templates", () => {
    expect(en.content.manager.importResult.inserted).toBe("{count} inserted");
    expect(en.content.manager.importResult.rowError).toBe("Row {row}: {errors}");
  });

  it("pins the empty state, pagination, and row action aria-labels", () => {
    expect(en.content.manager.empty).toBe("No {type} yet.");
    expect(en.content.manager.previous).toBe("Previous");
    expect(en.content.manager.next).toBe("Next");
    expect(en.content.manager.pageLabel).toBe("Page {page}");
    expect(en.content.manager.editAria).toBe("Edit {label}");
    expect(en.content.manager.deleteAria).toBe("Delete {label}");
    expect(en.content.manager.edit).toBe("Edit");
  });

  it("pins the delete-confirm dialog title and description templates", () => {
    expect(en.content.manager.deleteDialog.title).toBe("Delete {type} item");
    expect(en.content.manager.deleteDialog.description).toBe(
      'Permanently delete "{label}"? This cannot be undone.',
    );
  });

  it("pins every fallback error message", () => {
    expect(en.content.manager.error.load).toBe("Could not load this content list.");
    expect(en.content.manager.error.create).toBe("Could not create this item.");
    expect(en.content.manager.error.save).toBe("Could not save this item.");
    expect(en.content.manager.error.delete).toBe("Could not delete this item.");
    expect(en.content.manager.error.import).toBe("Could not import this CSV.");
    expect(en.content.manager.error.tooManyImports).toBe(
      "Too many import attempts — please wait a moment and try again.",
    );
  });
});

describe("admin.json EN — content-form.tsx + content-payload.ts (via ContentPayloadError)", () => {
  it("pins the dialog title templates and select placeholders", () => {
    expect(en.content.form.addTitle).toBe("Add {type}");
    expect(en.content.form.editTitle).toBe("Edit {type}");
    expect(en.content.form.selectNone).toBe("(none)");
    expect(en.content.form.selectPlaceholder).toBe("Select…");
    expect(en.content.form.saving).toBe("Saving…");
  });

  it("pins the field-validation error templates (was buildContentPayload's literal message)", () => {
    expect(en.content.errors.required).toBe("{label} is required.");
    expect(en.content.errors.invalidNumber).toBe("{label} must be a number.");
    expect(en.content.errors.invalidJson).toBe("{label} must be valid JSON.");
    expect(en.content.errors.validationFailed).toBe("Something went wrong validating this form.");
  });
});

describe("admin.json EN — admin/videos/page.tsx + video-queue.tsx", () => {
  it("pins the page heading and subtitle", () => {
    expect(en.videos.page.heading).toBe("Video queue");
    expect(en.videos.page.subtitle).toBe(
      "Review, approve, reject, and attach transcripts to submitted videos.",
    );
  });

  it("pins the loading, error, rate-limit, and empty states", () => {
    expect(en.videos.loading).toBe("Loading the video queue…");
    expect(en.videos.error.load).toBe("Could not load the video queue.");
    expect(en.videos.error.approve).toBe("Could not approve this video.");
    expect(en.videos.error.reject).toBe("Could not reject this video.");
    expect(en.videos.error.transcript).toBe("Could not save this transcript.");
    expect(en.videos.rateLimited).toBe(
      "Please wait a moment before submitting more moderation actions.",
    );
    expect(en.videos.empty).toBe("No videos are waiting for review right now.");
  });

  it("pins the row templates and transcript/approve/reject controls", () => {
    expect(en.videos.submittedBy).toBe("Submitted by {name}");
    expect(en.videos.submittedByUnknown).toBe("Submitted by an unknown user");
    expect(en.videos.estimate).toBe("Est. {level}");
    expect(en.videos.transcriptBadge).toBe("Transcript: {count} lines");
    expect(en.videos.noTranscript).toBe("No transcript");
    expect(en.videos.approve).toBe("Approve");
    expect(en.videos.approving).toBe("Approving…");
    expect(en.videos.attachTranscript).toBe("Attach transcript");
    expect(en.videos.reject).toBe("Reject");
    expect(en.videos.loadingMore).toBe("Loading…");
  });

  it("pins the reject dialog (a permanent hard-delete, per the task's honesty requirement)", () => {
    expect(en.videos.rejectDialog.title).toBe("Reject video");
    expect(en.videos.rejectDialog.description).toBe(
      "The video will be permanently removed, along with its transcript and any progress users have made on it. This cannot be undone.",
    );
    expect(en.videos.rejectDialog.reasonLabel).toBe("Reason (optional)");
    expect(en.videos.rejectDialog.reasonPlaceholder).toBe(
      "Not persisted publicly — logged for moderators only.",
    );
  });

  it("pins the attach-transcript dialog", () => {
    expect(en.videos.transcriptDialog.title).toBe("Attach transcript");
    expect(en.videos.transcriptDialog.formatLabel).toBe("Format");
    expect(en.videos.transcriptDialog.formatPlain).toBe("Plain text");
    expect(en.videos.transcriptDialog.contentLabel).toBe("Content");
    expect(en.videos.transcriptDialog.save).toBe("Save transcript");
    expect(en.videos.transcriptDialog.saving).toBe("Saving…");
  });
});

describe("admin.json EN — page-metadata document titles (Task 18)", () => {
  it("pins the four admin browser-tab titles (the 'Admin — ' prefix differs from each page heading)", () => {
    expect(en.meta.dashboard).toBe("Admin — Dashboard");
    expect(en.meta.videos).toBe("Admin — Video Queue");
    expect(en.meta.content).toBe("Admin — Content");
    expect(en.meta.contentType).toBe("Admin — {label}");
  });
});

describe("admin.json EN — style-guide.tsx", () => {
  it("pins the page heading, subtitle, and locale-nav aria-label", () => {
    expect(en.styleGuide.heading).toBe("Style guide");
    expect(en.styleGuide.subtitle).toBe(
      "Executable spec — tokens and primitives rendered from the live implementation.",
    );
    expect(en.styleGuide.localeNavAria).toBe("Style guide locale");
  });
});

describe("admin.json EN — token-sections.tsx", () => {
  it("pins every section heading (byte-identical — style-guide.test.tsx asserts these by role name)", () => {
    expect(en.styleGuide.sections.colour.heading).toBe("Colour");
    expect(en.styleGuide.sections.typography.heading).toBe("Typography");
    expect(en.styleGuide.sections.spacing.heading).toBe("Spacing");
    expect(en.styleGuide.sections.elevation.heading).toBe("Elevation");
    expect(en.styleGuide.sections.motion.heading).toBe("Motion");
    expect(en.styleGuide.sections.zIndex.heading).toBe("Z-index");
    expect(en.styleGuide.sections.primitives.heading).toBe("Primitives");
  });

  it("pins the colour tier subheadings and the semantic-tier note", () => {
    expect(en.styleGuide.sections.colour.primitiveTier).toBe("Primitive tier");
    expect(en.styleGuide.sections.colour.semanticTier).toBe("Semantic tier");
    expect(en.styleGuide.sections.colour.semanticNote).toBe(
      "Features consume ONLY this tier. Dark theme remaps it; L9b restyles by editing the mapping, not the features.",
    );
  });

  it("pins the typography and motion notes", () => {
    expect(en.styleGuide.sections.typography.note).toBe(
      "Body line-heights are sized for stacked Vietnamese diacritics; Japanese text takes leading-jp (spec §4.5 touchpoint 1).",
    );
    expect(en.styleGuide.sections.motion.note).toBe(
      "This line uses animate-fade-in (duration-base × ease-standard). With reduce motion on — toggle above — it must appear instantly.",
    );
  });

  it("pins the typography roles subheading and the radius section heading (Task 8)", () => {
    expect(en.styleGuide.sections.typography.rolesHeading).toBe("Font roles");
    expect(en.styleGuide.sections.radius.heading).toBe("Radius");
  });
});

describe("admin.json EN — primitive-sections.tsx", () => {
  it("pins the nine primitive demo names (asserted by role name in style-guide.test.tsx)", () => {
    expect(en.styleGuide.primitives.demo.button).toBe("Button");
    expect(en.styleGuide.primitives.demo.badge).toBe("Badge");
    expect(en.styleGuide.primitives.demo.skeleton).toBe("Skeleton");
    expect(en.styleGuide.primitives.demo.dialog).toBe("Dialog");
    expect(en.styleGuide.primitives.demo.tabs).toBe("Tabs");
    expect(en.styleGuide.primitives.demo.select).toBe("Select");
    expect(en.styleGuide.primitives.demo.tooltip).toBe("Tooltip");
    expect(en.styleGuide.primitives.demo.popover).toBe("Popover");
    expect(en.styleGuide.primitives.demo.toast).toBe("Toast");
  });

  it("pins the button demo's seven variant labels", () => {
    expect(en.styleGuide.primitives.button.primary).toBe("Primary");
    expect(en.styleGuide.primitives.button.secondary).toBe("Secondary");
    expect(en.styleGuide.primitives.button.outline).toBe("Outline");
    expect(en.styleGuide.primitives.button.ghost).toBe("Ghost");
    expect(en.styleGuide.primitives.button.disabled).toBe("Disabled");
    expect(en.styleGuide.primitives.button.small).toBe("Small");
    expect(en.styleGuide.primitives.button.large).toBe("Large");
  });

  it("pins the dialog demo", () => {
    expect(en.styleGuide.primitives.dialog.open).toBe("Open dialog");
    expect(en.styleGuide.primitives.dialog.title).toBe("Example dialog");
    expect(en.styleGuide.primitives.dialog.description).toBe(
      "Focus is trapped; Escape and backdrop close it.",
    );
    expect(en.styleGuide.primitives.dialog.done).toBe("Done");
  });

  it("pins the tabs demo", () => {
    expect(en.styleGuide.primitives.tabs.ariaLabel).toBe("Example tabs");
    expect(en.styleGuide.primitives.tabs.first).toBe("First");
    expect(en.styleGuide.primitives.tabs.second).toBe("Second");
    expect(en.styleGuide.primitives.tabs.firstPanel).toBe("First panel — arrow keys move selection.");
    expect(en.styleGuide.primitives.tabs.secondPanel).toBe("Second panel.");
  });

  it("pins the select, tooltip, popover, and toast demos", () => {
    expect(en.styleGuide.primitives.select.placeholder).toBe("Choose a level");
    expect(en.styleGuide.primitives.tooltip.content).toBe("Shown on hover and on keyboard focus");
    expect(en.styleGuide.primitives.tooltip.trigger).toBe("Focus or hover me");
    expect(en.styleGuide.primitives.popover.trigger).toBe("Open popover");
    expect(en.styleGuide.primitives.popover.content).toBe("Interactive floating content.");
    expect(en.styleGuide.primitives.toast.success).toBe("Success toast");
    expect(en.styleGuide.primitives.toast.danger).toBe("Danger toast");
    expect(en.styleGuide.primitives.toast.savedTitle).toBe("Saved");
    expect(en.styleGuide.primitives.toast.failedTitle).toBe("Something failed");
    expect(en.styleGuide.primitives.toast.failedDescription).toBe("With a description line.");
  });
});
