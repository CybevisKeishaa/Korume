/**
 * jsdom has no PointerEvent, so fireEvent.pointer* falls back to a plain Event and drops pointerId, pointerType
 * and the coordinates. Call once at the top of a test file that reads them. Assigned, not `vi.stubGlobal`, so a
 * file's `vi.unstubAllGlobals()` cannot remove it between tests (each test file has its own environment).
 */
export function installPointerEventShim(): void {
  if (typeof globalThis.PointerEvent !== "undefined") return;
  class PointerEventShim extends MouseEvent {
    pointerId: number;
    pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
      this.pointerType = init.pointerType ?? "mouse";
    }
  }
  globalThis.PointerEvent = PointerEventShim as unknown as typeof PointerEvent;
}
