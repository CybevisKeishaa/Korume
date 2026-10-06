/** Spec §3.1 / §5: transient workspace settings; nothing persists in V1. */
export interface PrintSettings {
  mode: "review" | "selfTest";
  showReading: boolean;
  showMeaning: boolean;
  showExample: boolean;
  /** Self-test only: the field replaced by a writing line. */
  hide: "meaning" | "reading";
  density: "airy" | "compact";
}

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  mode: "review", showReading: true, showMeaning: true, showExample: true, hide: "meaning", density: "airy",
};
