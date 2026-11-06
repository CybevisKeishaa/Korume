import type { KanjiComponentNode } from "@/lib/dictionary/types";

/** The composition chips (spec §5.2): the root's named children, descending through unnamed KanjiVG groups. */
export function compositionElements(root: KanjiComponentNode): string[] {
  const out: string[] = [];
  const walk = (node: KanjiComponentNode) => {
    if (node.element && node.element !== root.element) out.push(node.element);
    else node.children.forEach(walk);
  };
  root.children.forEach(walk);
  return [...new Set(out)];
}
