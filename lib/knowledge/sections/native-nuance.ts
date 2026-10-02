import { z } from "zod/v4";
import { dataBlocks, defineSection, sectionSystem } from "./prompt";

export const nativeNuanceSchema = z.object({
  register: z.string(),
  nuance: z.string(),
  whenToUse: z.string(),
  whenNotTo: z.string(),
});
export const nativeNuancePreviewSchema = z.object({ register: z.string(), nuance: z.string() });

/** How it sounds to a native speaker in this video's setting; keyed by the video (spec §4.2). */
export const nativeNuanceSection = defineSection({
  section: "native_nuance",
  schema: nativeNuanceSchema,
  previewSchema: nativeNuancePreviewSchema,
  schemaVersion: 1,
  generatorVersion: 1,
  contextPolicy: "video",
  access: "free_preview",
  maxOutputTokens: { full: 700, preview: 200 },
  buildPrompt: (input, variant) => ({
    system: sectionSystem(input.locale, [
      "Describe how this sentence sounds to a native speaker, in the setting of the video.",
      "register: casual, polite, formal, rough, childish… in a few words. nuance: the feeling it carries, in two sentences.",
      variant === "preview"
        ? "Fill only register and nuance."
        : "whenToUse: situations where a learner can say it. whenNotTo: situations where it would sound wrong, and what to say instead.",
    ].join("\n")),
    user: dataBlocks({ sentence: input.sentence, video_title: input.videoTitle }),
  }),
  projectPreview: (full) => ({ register: full.register, nuance: full.nuance }),
});
