/**
 * Throws unless `value` survives the RSC/JSON boundary unchanged: primitives, arrays and plain objects only.
 * A function, class instance, Map, Set, Date or BigInt in a server → client DTO either blanks the page or
 * arrives silently altered (memory: rsc-client-props-strings-only), and jsdom never notices.
 */
export function assertPlainSerializableDto(value: unknown, path = "$"): void {
  const fail = (what: string): never => {
    throw new Error(`not a plain DTO at ${path}: ${what}`);
  };
  if (value === null) return;
  switch (typeof value) {
    case "string":
    case "boolean":
      return;
    case "number":
      if (!Number.isFinite(value)) fail(String(value));
      return;
    case "undefined":
      return; // object properties only; arrays are checked below
    case "object":
      break;
    default:
      fail(typeof value);
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      if (item === undefined) fail(`undefined at index ${index}`);
      assertPlainSerializableDto(item, `${path}[${index}]`);
    });
    return;
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) fail(proto?.constructor?.name ?? "exotic object");
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    assertPlainSerializableDto(child, `${path}.${key}`);
  }
}
