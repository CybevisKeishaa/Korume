"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { RenderPayload } from "@/lib/vocabulary/print/pdf/request";
import { useSheetLabels } from "./labels";
import { Worksheet } from "./worksheet";

/** True when any item or answer ends below its own sheet's quote band (spec W §6.3 step 5). */
export function overflowing(root: ParentNode): boolean {
  return [...root.querySelectorAll(".vp-sheet")].some((sheet) => {
    const limit = sheet.querySelector(".vp-quote")?.getBoundingClientRect().top;
    if (limit === undefined) return false;
    return [...sheet.querySelectorAll(".vp-item, .vp-answer")].some((unit) => unit.getBoundingClientRect().bottom > limit + 0.5);
  });
}

/** The PDF render target: exactly the payload's pages, the same print root as `In`, no measuring, no paginating. */
export function PdfRender({ payload }: { payload: RenderPayload }) {
  const labels = useSheetLabels(payload.settings.mode, payload.title);
  const [portal, setPortal] = useState<HTMLElement | null>(null);
  const [state, setState] = useState<"rendering" | "ready" | "error">("rendering");

  useEffect(() => setPortal(document.body), []);

  useEffect(() => {
    if (!portal) return;
    let live = true;
    void (async () => {
      const root = document.querySelector<HTMLElement>("[data-print-root]");
      root?.getBoundingClientRect(); // force layout, so every glyph's font slice is requested before fonts.ready
      await (document as Document & { fonts?: FontFaceSet }).fonts?.ready;
      await Promise.all([...(root?.querySelectorAll("img") ?? [])].map((image) => image.decode().catch(() => undefined)));
      if (live) setState(root && overflowing(root) ? "error" : "ready");
    })();
    return () => { live = false; };
  }, [portal]);

  if (!portal) return null;
  return createPortal(
    <div data-print-root="" data-pdf-ready={state === "ready" ? "" : undefined} data-pdf-error={state === "error" ? "" : undefined}>
      <Worksheet pages={payload.pages} settings={payload.settings} labels={labels} resources={payload.resources} />
    </div>,
    portal,
  );
}
