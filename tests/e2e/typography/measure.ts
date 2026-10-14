export interface TypeFinding { kind: "type" | "clip" | "hscroll"; where: string; detail: string }

/** Computed [size, line-height] of each token, read from probe elements (a custom property's own value is an
 *  unresolved calc string, so the CSS must be applied to be measured). */
export function readTokens(tokens: readonly string[]): Record<string, [number, number]> {
  const out: Record<string, [number, number]> = {};
  for (const token of tokens) {
    const probe = document.createElement("span");
    probe.className = `text-${token}`;
    probe.textContent = "x";
    document.body.append(probe);
    const style = getComputedStyle(probe);
    out[token] = [parseFloat(style.fontSize), parseFloat(style.lineHeight)];
    probe.remove();
  }
  return out;
}

/** Spec G4 checks 2 and 3 on the current page. */
export function inspectPage(args: { pairs: Array<readonly [number, number]>; tolerance: number; exempt: Record<string, "all" | "line-height"> }): TypeFinding[] {
  const { pairs, tolerance, exempt } = args;
  const findings: TypeFinding[] = [];
  const near = (a: number, b: number) => Math.abs(a - b) <= tolerance;
  const label = (el: Element) => {
    const cls = typeof el.className === "string" && el.className.trim() ? `.${el.className.trim().split(/\s+/).slice(0, 3).join(".")}` : "";
    return `${el.tagName.toLowerCase()}${cls} "${(el.textContent ?? "").trim().slice(0, 40)}"`;
  };
  const shown = (el: Element) => {
    const rect = el.getBoundingClientRect();
    return rect.width > 1 && rect.height > 1 && el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
  };
  const scopeOf = (el: Element) => {
    const holder = el.closest("[data-type-exempt]");
    return holder ? exempt[holder.getAttribute("data-type-exempt") ?? ""] : undefined;
  };
  const checkType = (el: Element) => {
    const scope = scopeOf(el);
    if (scope === "all") return;
    const style = getComputedStyle(el);
    const size = parseFloat(style.fontSize);
    const leading = style.lineHeight === "normal" ? Number.NaN : parseFloat(style.lineHeight);
    // Chromium forces `line-height: normal` on a drop-down <select> whatever the author sets, so only its size is judged.
    const sizeOnly = scope === "line-height" || (el instanceof HTMLSelectElement && style.lineHeight === "normal");
    if (!pairs.some(([s, l]) => near(size, s) && (sizeOnly || near(leading, l)))) {
      findings.push({ kind: "type", where: label(el), detail: `${style.fontSize} / ${style.lineHeight}` });
    }
  };

  const seen = new Set<Element>();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const el = node.parentElement;
    if (!el || seen.has(el) || !node.textContent?.trim() || el.closest("script, style, noscript, template")) continue;
    seen.add(el);
    if (shown(el)) checkType(el);
  }
  const fields = document.querySelectorAll("input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]), textarea, select");
  for (const el of fields) if (shown(el)) checkType(el);

  for (const el of document.querySelectorAll('button, [role="button"], nav a, [lang="ja"]')) {
    // Spec G2: an element under a scope-`all` marker is skipped by the gate (e.g. the print sheet's physical-unit tiles).
    if (!(el instanceof HTMLElement) || el.clientWidth === 0 || !shown(el) || scopeOf(el) === "all") continue;
    const full = (el.textContent ?? "").trim();
    if (!full) continue;
    const style = getComputedStyle(el);
    const carriesFullText = `${el.title} ${el.getAttribute("aria-label") ?? ""}`.includes(full);
    const truncatesOnPurpose = style.textOverflow === "ellipsis" || style.webkitLineClamp !== "none";
    if (truncatesOnPurpose && carriesFullText) continue;
    if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) {
      findings.push({ kind: "clip", where: label(el), detail: `content ${el.scrollWidth}x${el.scrollHeight} in box ${el.clientWidth}x${el.clientHeight}` });
    }
  }
  const pageWidth = document.documentElement.scrollWidth;
  if (pageWidth > window.innerWidth) findings.push({ kind: "hscroll", where: "document", detail: `${pageWidth} > ${window.innerWidth}` });
  return findings;
}

/** Spec V4 — raw numbers for the owner; no threshold. */
export function readRatios(cardSelector: string): Record<string, number | string> {
  const card = document.querySelector(cardSelector);
  if (!card) return { error: `no element matches ${cardSelector}` };
  const probe = document.createElement("span");
  probe.className = "text-body";
  probe.textContent = "x";
  card.append(probe);
  const body = parseFloat(getComputedStyle(probe).fontSize);
  probe.remove();
  const box = card.getBoundingClientRect();
  const icon = card.querySelector("svg")?.getBoundingClientRect().width ?? Number.NaN;
  const control = document.querySelector("main button")?.getBoundingClientRect().height ?? Number.NaN;
  const padding = parseFloat(getComputedStyle(card).paddingLeft);
  return {
    bodyPx: body, cardWidthPx: box.width, iconPx: icon, controlHeightPx: control, cardPaddingPx: padding,
    bodyPerCardWidth: body / box.width, iconPerBody: icon / body, controlPerBody: control / body, paddingPerBody: padding / body,
  };
}
