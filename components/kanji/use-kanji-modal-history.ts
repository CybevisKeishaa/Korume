"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/lib/i18n/navigation";
import { parseKanjiLiteral } from "@/lib/dictionary/literal";
import { kanjiModalHref } from "@/lib/kanji/href";

/**
 * The `?kanji=` modal's history rule (spec §5.1). `openedInApp` is true once the param has been absent while this
 * hook was mounted — so a link click or Forward closes with `back()`, while a URL that already carried the param on
 * the first render (shared link, refresh, new tab) closes with `replace` and the learner stays on the page.
 */
export function useKanjiModalHistory() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const raw = params.get("kanji");
  const literal = raw === null ? null : parseKanjiLiteral(raw);
  const from = params.get("from");
  const [openedInApp, setOpenedInApp] = useState(literal === null);
  if (literal === null && !openedInApp) setOpenedInApp(true);

  function close() {
    if (openedInApp) return router.back();
    const rest = new URLSearchParams(params);
    rest.delete("kanji");
    rest.delete("from");
    const search = rest.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  }

  function go(next: string) {
    router.replace(kanjiModalHref(pathname, params.toString(), next, from ?? undefined), { scroll: false });
  }

  return { literal, from, openedInApp: literal !== null && openedInApp, close, go };
}
