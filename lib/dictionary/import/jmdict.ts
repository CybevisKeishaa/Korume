import { streamXml } from "./xml-stream";

export interface JmdictSense {
  pos: string[];
  gloss: string[];
  misc: string[];
}

export interface JmdictEntryRow {
  entSeq: number;
  kanjiForms: string[];
  kanaForms: string[];
  senses: JmdictSense[];
  common: boolean;
}

/** JMdict's own definition of a "common" word: one of these priority codes on any form. */
const COMMON_PRIORITIES = new Set(["news1", "ichi1", "spec1", "spec2", "gai1"]);

/** Streams `<entry>` elements; never builds the whole document. */
export async function* readJmdict(input: AsyncIterable<Buffer | string>): AsyncGenerator<JmdictEntryRow> {
  let entry: JmdictEntryRow | null = null;
  let sense: JmdictSense | null = null;
  let previousPos: string[] = [];
  let glossIsEnglish = true;

  yield* streamXml<JmdictEntryRow>(input, {
    open(tag) {
      if (tag.name === "entry") {
        entry = { entSeq: 0, kanjiForms: [], kanaForms: [], senses: [], common: false };
        previousPos = [];
      } else if (tag.name === "sense") {
        sense = { pos: [], gloss: [], misc: [] };
      } else if (tag.name === "gloss") {
        const lang = tag.attributes["xml:lang"];
        glossIsEnglish = lang === undefined || lang === "eng";
      }
    },
    close(name, text, emit) {
      if (!entry) return;
      const value = text.trim();
      switch (name) {
        case "ent_seq":
          entry.entSeq = Number(value);
          break;
        case "keb":
          entry.kanjiForms.push(value);
          break;
        case "reb":
          entry.kanaForms.push(value);
          break;
        case "ke_pri":
        case "re_pri":
          if (COMMON_PRIORITIES.has(value)) entry.common = true;
          break;
        case "pos":
          sense?.pos.push(value);
          break;
        case "misc":
          sense?.misc.push(value);
          break;
        case "gloss":
          if (glossIsEnglish) sense?.gloss.push(value);
          break;
        case "sense":
          if (sense) {
            // JMdict: a sense without <pos> inherits the part of speech of the sense before it.
            if (sense.pos.length === 0) sense.pos = [...previousPos];
            previousPos = sense.pos;
            entry.senses.push(sense);
          }
          sense = null;
          break;
        case "entry":
          if (!Number.isInteger(entry.entSeq) || entry.entSeq <= 0) throw new Error("JMdict entry without ent_seq");
          emit(entry);
          entry = null;
          break;
      }
    },
  });
}
