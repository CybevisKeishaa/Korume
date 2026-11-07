/** Owner ruling K16: shown wherever an imported Vietnamese meaning (`dict_kanji.vi_meanings`) renders. */
export const HVDIC_SOURCE = { url: "https://hvdic.thivien.net", credit: "Từ điển Hán Nôm (hvdic.thivien.net)" } as const;

/**
 * K16 precedence: the curated `kanji.meaning_vi`, else the imported glosses (override file, then hvdic, resolved at
 * import), else nothing. Glosses join with "; " because one gloss may hold a comma.
 */
export function viMeaning(curated: string | null | undefined, imported: string[]): { meaningVi: string | null; viFromHvdic: boolean } {
  const own = curated?.trim();
  if (own) return { meaningVi: own, viFromHvdic: false };
  return imported.length > 0 ? { meaningVi: imported.join("; "), viFromHvdic: true } : { meaningVi: null, viFromHvdic: false };
}
