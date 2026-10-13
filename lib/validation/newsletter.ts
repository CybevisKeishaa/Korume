import { z } from "zod";

/** PATCH /api/user/newsletter body (app-footer spec N2–N4). The email is never accepted from the client. */
export const newsletterSchema = z.object({ optIn: z.boolean() });
export type NewsletterInput = z.infer<typeof newsletterSchema>;

/** What the footer and the Settings row render from. Client-safe (no server import). */
export interface NewsletterState {
  email: string;
  optedIn: boolean;
}
