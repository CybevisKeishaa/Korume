"use client";

import { useId, useState } from "react";
import { useTranslations } from "@/lib/i18n";
import { useRouter } from "@/lib/i18n/navigation";
import { useToast } from "@/components/ui/toast";

/**
 * The typed confirmation and the button behind Erase Korume Memory
 * (spec §4.8).
 *
 * The word the user types is TRANSLATED (`memoryErase.confirmWord` — "ERASE"
 * in English, "XOA" in Vietnamese): asking a Vietnamese learner to type an
 * English word to arm a destructive action makes the confirmation a typing
 * test rather than a moment of intent. The request body is always the ASCII
 * literal, because the server's check must not depend on a locale it never
 * reads — see `lib/validation/memory-erase.ts`.
 *
 * On failure this renders its OWN message and never the response body. The
 * route already answers opaquely, so this is the second of two independent
 * guarantees, not a duplicate of the first: the client never starts reading
 * server text at all, which is what keeps the "no server string in a
 * `role=\"alert\"`" property airtight (the defect class L9a closed five
 * times). It branches on nothing but `response.ok`.
 */
export function MemoryEraseForm() {
  const t = useTranslations("settings");
  const router = useRouter();
  const { toast } = useToast();
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputId = useId();

  const confirmWord = t("memoryErase.confirmWord");
  const ready = typed === confirmWord && !submitting;

  async function submit(): Promise<void> {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/user/memory-erase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "ERASE" }),
      });
      if (!response.ok) {
        setError(t("memoryErase.failed"));
        return;
      }
      // The toast outlives this navigation: `ToastProvider` is mounted in
      // `app/[locale]/layout.tsx`, above the route segment being left.
      toast({ title: t("memoryErase.done"), variant: "success" });
      router.push("/settings#privacy");
    } catch {
      setError(t("memoryErase.failed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-xl">
      <label htmlFor={inputId} className="block text-caption text-muted-foreground">
        {t("memoryErase.typePrompt", { word: confirmWord })}
      </label>
      <input
        id={inputId}
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        className="mt-xs h-control-md w-full max-w-[20rem] rounded-full border border-border bg-transparent px-md"
        autoComplete="off"
      />

      {error ? (
        <p role="alert" className="mt-md text-caption text-danger-strong">
          {error}
        </p>
      ) : null}

      <div className="mt-lg flex flex-wrap items-center gap-sm">
        <button
          type="button"
          disabled={!ready}
          onClick={() => void submit()}
          className="h-control-md rounded-full bg-danger px-lg text-caption font-semibold text-danger-foreground disabled:opacity-50"
        >
          {t("memoryErase.submit")}
        </button>
        <button
          type="button"
          onClick={() => router.push("/settings#privacy")}
          className="h-control-md rounded-full bg-secondary px-lg text-caption"
        >
          {t("memoryErase.cancel")}
        </button>
      </div>
    </div>
  );
}
