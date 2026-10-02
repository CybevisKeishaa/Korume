import { z } from "zod/v4";
import { dataBlocks, defineSection, sectionSystem } from "./prompt";

const note = z.object({ title: z.string(), body: z.string() });
export const cultureNotesSchema = z.object({ notes: z.array(note) });
export const cultureNotesPreviewSchema = z.object({ notes: z.array(note) });

/** Read against the video it was heard in, so it is keyed by that video (spec §4.2). */
export const cultureNotesSection = defineSection({
  section: "culture_notes",
  schema: cultureNotesSchema,
  previewSchema: cultureNotesPreviewSchema,
  schemaVersion: 1,
  generatorVersion: 1,
  contextPolicy: "video",
  access: "free_preview",
  maxOutputTokens: { full: 900, preview: 250 },
  buildPrompt: (input, variant) => ({
    system: sectionSystem(input.locale, [
      `Give ${variant === "preview" ? "exactly one cultural note" : "one to three cultural notes"} a learner needs to understand this sentence as a Japanese listener would, in the setting of the video.`,
      "Cover politeness, social relationships, customs or implied meaning — not grammar.",
      "If nothing cultural is worth saying, return one note that says so.",
      "title: a few words. body: two or three sentences.",
    ].join("\n")),
    user: dataBlocks({ sentence: input.sentence, video_title: input.videoTitle }),
  }),
  projectPreview: (full) => ({ notes: full.notes.slice(0, 1) }),
});
