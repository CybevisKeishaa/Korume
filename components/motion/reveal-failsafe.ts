/**
 * The landing page's entrance motion hides content before revealing it, and
 * this is what guarantees the reveal happens even when the code that performs
 * it never arrives.
 *
 * ## The gap this closes
 *
 * `globals.css`'s hidden state is gated on `:root[data-reduce-motion="false"]`,
 * which `themeInitScript` sets before paint. That gate proves **JS ran** — the
 * init script is inline in `<head>`, outside the client bundle, so it executes
 * whenever scripting is enabled at all. It does NOT prove the **observer ran**.
 * `RevealScope` lives in the bundle, and the bundle can fail on its own: a 404,
 * a blocking extension or corporate proxy, an aborted hydration, or
 * `IntersectionObserver` throwing. In that state the init script arms the
 * hidden rule and nothing ever disarms it, so every heading, eyebrow, body and
 * showcase on the page stays invisible for good. Two independent failure
 * domains, and the CSS was treating the first as proof of the second.
 *
 * ## Why a string, and why it only ever RELEASES
 *
 * This runs as an inline `<script>`, not as bundled code — code delivered by
 * the bundle cannot rescue the bundle failing to arrive.
 *
 * It deliberately does not ARM anything. Arming late would show content and
 * then hide it, and an inline script in the body runs after the markup above it
 * has parsed. Releasing late is harmless: it can only turn content visible, and
 * `themeInitScript` has already done the arming in `<head>` with no flash.
 */

/**
 * How long the page waits for `RevealScope` before revealing itself.
 *
 * Long enough that an ordinary hydration wins the race and the entrance still
 * plays; short enough that a reader looking at a blank page is not left there.
 */
export const REVEAL_FAILSAFE_MS = 3000;

/**
 * The global `RevealScope` sets once its observer is constructed AND observing
 * targets — deliberately not when its effect starts. A flag set on entry would
 * report "the code began" where the failsafe needs "something is watching for
 * the reveal", and `new IntersectionObserver` throwing sits between the two.
 *
 * ⚠️ It is still a presence signal, not a behavioural one. An observer that is
 * constructed and then silently never fires — a stub rather than a throw —
 * disarms the failsafe, and that case is NOT covered here. Closing it would
 * mean releasing on "nothing has been revealed yet", which cannot tell a dead
 * observer from a backgrounded tab; releasing there would let the observer
 * later animate `reveal-rise` from opacity 0 over content the reader is
 * already looking at, because the `[data-reveal="in"]` rules in globals.css
 * carry no failsafe escape. The weaker signal is the deliberate choice.
 */
export const REVEAL_MOUNTED_FLAG = "__korumeRevealMounted";

/**
 * Set on `<html>` when the observer never reported in. Every hidden rule in
 * `globals.css` carries `:not([data-reveal-failsafe])`, so this one attribute
 * releases the whole page at once — pinned by size in `design-tokens.test.ts`,
 * because releasing only some of the rules would rescue only some of the page.
 */
export const REVEAL_FAILSAFE_ATTR = "data-reveal-failsafe";

/** Injected verbatim by the marketing layout. Kept in sync by construction: the
 *  constants above are interpolated rather than restated (CLAUDE.md §6). */
export const revealFailsafeScript = `
(function () {
  try {
    window.setTimeout(function () {
      if (window["${REVEAL_MOUNTED_FLAG}"]) return;
      document.documentElement.setAttribute("${REVEAL_FAILSAFE_ATTR}", "");
    }, ${REVEAL_FAILSAFE_MS});
  } catch (e) {}
})();
`;
