import { SaxesParser } from "saxes";

export interface KanjiComponentNode {
  element: string | null;
  position: string | null;
  children: KanjiComponentNode[];
}

export class UnsafeKanjivgError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeKanjivgError";
  }
}

const KVG_GROUP_ATTRIBUTES = [
  "element", "variant", "partial", "original", "part", "number", "tradForm", "radicalForm", "position", "radical", "phon",
].map((name) => `kvg:${name}`);

/** Every element and attribute present in the KanjiVG 20260714 `main` corpus (T0); anything else is refused. */
const ALLOWED: Record<string, ReadonlySet<string>> = {
  svg: new Set(["xmlns", "xmlns:kvg", "width", "height", "viewBox"]),
  g: new Set(["id", "style", ...KVG_GROUP_ATTRIBUTES]),
  path: new Set(["id", "d", "kvg:type"]),
  text: new Set(["transform"]),
};

const PATH_DATA = /^[MmLlHhVvCcSsQqTtAaZz0-9., -]+$/;
const STYLE = /^(?:[a-z-]+:[#a-z0-9.]+;?)+$/i;
const TRANSFORM = /^matrix\([0-9. -]+\)$/;
const NUMBER = /^[0-9.]+$/;
const STROKE_ID = /^kvg:[0-9a-f]+-s(\d+)$/;
const WRAPPER_ID = /^kvg:Stroke(Paths|Numbers)_/;

function checkAttribute(element: string, name: string, value: string): void {
  if (!ALLOWED[element]?.has(name)) throw new UnsafeKanjivgError(`attribute ${name} on <${element}>`);
  const ok =
    name === "d" ? PATH_DATA.test(value)
    : name === "style" ? STYLE.test(value)
    : name === "transform" ? TRANSFORM.test(value)
    : name === "width" || name === "height" ? NUMBER.test(value)
    : name === "viewBox" ? /^[0-9. ]+$/.test(value)
    : name === "xmlns" || name === "xmlns:kvg" ? /^https?:\/\/[a-z0-9./-]+$/i.test(value)
    : !/[<>]/.test(value);
  if (!ok) throw new UnsafeKanjivgError(`unsafe ${name} value on <${element}>`);
}

/**
 * Returns the ordered stroke path `d` strings and the element grouping of one KanjiVG SVG. Throws
 * `UnsafeKanjivgError` on anything outside the allow-list: markup is never stored, so it is never rendered.
 */
export function sanitizeKanjivgSvg(svg: string): { paths: string[]; components: KanjiComponentNode } {
  const parser = new SaxesParser();
  const strokes = new Map<number, string>();
  const groupStack: (KanjiComponentNode | null)[] = [];
  const roots: KanjiComponentNode[] = [];
  const elementStack: string[] = [];

  parser.on("processinginstruction", () => {
    throw new UnsafeKanjivgError("processing instruction");
  });
  parser.on("cdata", () => {
    throw new UnsafeKanjivgError("CDATA section");
  });
  parser.on("text", (text) => {
    const inside = elementStack.at(-1);
    if (inside === "text" ? !/^\s*\d+\s*$/.test(text) : text.trim() !== "") {
      throw new UnsafeKanjivgError(`text content inside <${inside ?? "document"}>`);
    }
  });
  parser.on("opentag", (tag) => {
    const name = tag.name;
    if (!(name in ALLOWED)) throw new UnsafeKanjivgError(`element <${name}>`);
    const attributes = tag.attributes as Record<string, string>;
    for (const [attribute, value] of Object.entries(attributes)) checkAttribute(name, attribute, value);
    elementStack.push(name);

    if (name === "path") {
      const match = STROKE_ID.exec(attributes.id ?? "");
      if (!match || !attributes.d) throw new UnsafeKanjivgError("stroke path without a stroke id or data");
      const stroke = Number(match[1]);
      if (strokes.has(stroke)) throw new UnsafeKanjivgError(`duplicate stroke ${stroke}`);
      strokes.set(stroke, attributes.d);
    } else if (name === "g") {
      const id = attributes.id ?? "";
      const node: KanjiComponentNode | null = WRAPPER_ID.test(id)
        ? null
        : { element: attributes["kvg:element"] ?? null, position: attributes["kvg:position"] ?? null, children: [] };
      if (node) {
        const parent = [...groupStack].reverse().find((candidate) => candidate !== null);
        if (parent) parent.children.push(node);
        else roots.push(node);
      }
      groupStack.push(node);
    }
  });
  parser.on("closetag", (tag) => {
    elementStack.pop();
    if (tag.name === "g") groupStack.pop();
  });

  try {
    parser.write(svg).close();
  } catch (error) {
    if (error instanceof UnsafeKanjivgError) throw error;
    throw new UnsafeKanjivgError(`malformed SVG: ${(error as Error).message}`);
  }

  const order = [...strokes.keys()].sort((a, b) => a - b);
  if (order.length === 0 || order.some((stroke, index) => stroke !== index + 1)) {
    throw new UnsafeKanjivgError("stroke ids are not 1..N");
  }
  return {
    paths: order.map((stroke) => strokes.get(stroke) as string),
    components: roots[0] ?? { element: null, position: null, children: [] },
  };
}
