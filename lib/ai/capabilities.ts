/**
 * What the PRODUCT requires of any AI provider — declared permanently, in
 * application terms, independent of who is configured (Spec §5.4).
 *
 * A provider that cannot meet these cannot serve production. In dev the gap is
 * reported at startup and the app runs; a provider's limits are never a reason
 * to narrow the port (Spec §2).
 */
import type { Capabilities } from "./port";

export const REQUIRED_CAPABILITIES: Capabilities = {
  promptCaching: true, // Knowledge Economy cost model (business-model.md)
  reasoning: true, // sessionCorrections + summarizeTranscript
  structuredOutput: true, // all three schemas in lib/ai/schemas.ts
};
