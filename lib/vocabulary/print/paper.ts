/** Spec §3.2: the one paper config — preview sheets, the measurement tree and the print sheets all read it. */
export const PAPER = { widthMm: 210, heightMm: 297, marginMm: 14 } as const;
/** CSS defines 1in = 96px = 25.4mm, so this is exact in every browser. */
export const MM_TO_PX = 96 / 25.4;

export function paperVars(): Record<string, string> {
  return { "--vp-width": `${PAPER.widthMm}mm`, "--vp-height": `${PAPER.heightMm}mm`, "--vp-margin": `${PAPER.marginMm}mm` };
}
