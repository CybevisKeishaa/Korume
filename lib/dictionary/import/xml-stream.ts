import { SaxesParser, type SaxesTagPlain } from "saxes";

export interface XmlHandlers<T> {
  open(tag: SaxesTagPlain): void;
  /** `text` is the text collected since the last open tag. */
  close(name: string, text: string, emit: (row: T) => void): void;
}

/**
 * Streams rows out of an XML byte stream without building a document. DTD entities such as JMdict's
 * `&n;` expand to their own name, so a part-of-speech code stays a code.
 */
export async function* streamXml<T>(input: AsyncIterable<Buffer | string>, handlers: XmlHandlers<T>): AsyncGenerator<T> {
  const parser = new SaxesParser();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const queue: T[] = [];
  const emit = (row: T) => queue.push(row);
  let text = "";

  parser.on("doctype", (doctype) => {
    for (const [, name] of doctype.matchAll(/<!ENTITY\s+([^\s%]+)\s/g)) if (name) parser.ENTITIES[name] = name;
  });
  parser.on("opentag", (tag) => {
    text = "";
    handlers.open(tag as SaxesTagPlain);
  });
  parser.on("text", (chunk) => {
    text += chunk;
  });
  parser.on("closetag", (tag) => {
    handlers.close(tag.name, text, emit);
    text = "";
  });

  for await (const chunk of input) {
    parser.write(typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true }));
    while (queue.length > 0) yield queue.shift() as T;
  }
  parser.write(decoder.decode());
  parser.close();
  while (queue.length > 0) yield queue.shift() as T;
}
