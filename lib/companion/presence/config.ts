/** Tuning constants (hidden — never surfaced in UI, like PHASE_THRESHOLDS). */

/** Experience-cooldown window (Spec 1 §5.10): after one address, further
 * ambient-band contexts inside this window are suppressed. */
export const COOLDOWN_WINDOW_MS = 90_000;

/** A pending context older than this is stale and silently discarded —
 * relevance decay, not a behavior-initiating timer (§5.7 is not violated). */
export const CONTEXT_TTL_MS = 5 * 60_000;

/** Priorities at or below this may break through an active cooldown
 * ("significantly higher priority", §5.10) — i.e. milestone bands only. */
export const COOLDOWN_OVERRIDE_MAX_PRIORITY = 20;

/** A finished address may auto-fade after this long — ending a speech turn
 * is presentation, not a timer-initiated behavior. */
export const SPEECH_AUTO_FADE_MS = 8_000;
