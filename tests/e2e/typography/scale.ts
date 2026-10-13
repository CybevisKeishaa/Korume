/**
 * Spec S2 — the approved type scale, written as LITERAL numbers on purpose. A gate that compared rendered text
 * with whatever the tokens currently resolve to would stay green if both were wrong. 16px root, Display scale 1,
 * [size, line-height] in px. The vitest pin (lib/design-tokens.test.ts) and the Playwright gate both import this.
 */
export const VIEWPORTS = [
  { name: "1280", width: 1280, height: 529 },
  { name: "1440", width: 1440, height: 900 },
  { name: "1920", width: 1920, height: 1080 },
] as const;
export type ViewportName = (typeof VIEWPORTS)[number]["name"];

export const TOKENS = ["caption", "body", "body-lg", "heading", "heading-lg", "title", "display"] as const;
export type Token = (typeof TOKENS)[number];

export const SCALE: Record<ViewportName, Record<Token, readonly [number, number]>> = {
  "1280": { caption: [11, 16.5], body: [12.44, 19.56], "body-lg": [14.22, 23.11], heading: [17.78, 24.89], "heading-lg": [21.33, 28.44], title: [24.89, 32], display: [35.56, 42.67] },
  "1440": { caption: [12, 18], body: [14, 22], "body-lg": [16, 26], heading: [20, 28], "heading-lg": [24, 32], title: [28, 36], display: [40, 48] },
  "1920": { caption: [15, 22.5], body: [17.5, 27.5], "body-lg": [20, 32.5], heading: [25, 35], "heading-lg": [30, 40], title: [35, 45], display: [50, 60] },
};

export const TOLERANCE = 0.05;
