import { z } from "zod";

/** PATCH /api/user/model-training-consent body. */
export const modelTrainingConsentSchema = z.object({
  consent: z.boolean(),
});
export type ModelTrainingConsentInput = z.infer<typeof modelTrainingConsentSchema>;
