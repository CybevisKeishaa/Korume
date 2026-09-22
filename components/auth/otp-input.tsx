"use client";

import { useRef, useState } from "react";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const LENGTH = 6;

export function OtpInput({
  name,
  onComplete,
  errorId,
  invalid,
}: {
  name: string;
  onComplete?: () => void;
  errorId?: string;
  invalid?: boolean;
}) {
  const t = useTranslations("auth");
  const [digits, setDigits] = useState<string[]>(() => Array(LENGTH).fill(""));
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  function commit(next: string[]): boolean {
    const complete = next.every((digit) => digit !== "");
    setDigits(next);
    // Every commit that leaves the code complete hands focus back, not only
    // the first: retyping one digit of a full code must still reach Verify.
    if (complete) onComplete?.();
    return complete;
  }

  function fill(start: number, raw: string) {
    const incoming = raw.replace(/\D/g, "").slice(0, LENGTH - start).split("");
    if (incoming.length === 0) {
      setDigits([...digits]);
      return;
    }

    const next = [...digits];
    incoming.forEach((digit, index) => {
      next[start + index] = digit;
    });

    if (!commit(next)) {
      const nextEmpty = next.findIndex(
        (digit, index) => index >= start + incoming.length && digit === "",
      );
      inputs.current[nextEmpty === -1 ? next.indexOf("") : nextEmpty]?.focus();
    }
  }

  return (
    <div
      role="group"
      aria-label={t("otp.groupLabel")}
      aria-describedby={errorId}
      className="flex gap-sm"
    >
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            inputs.current[index] = element;
          }}
          value={digit}
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          aria-label={t("otp.digitLabel", { index: index + 1, total: LENGTH })}
          aria-invalid={invalid}
          onChange={(event) => {
            const inserted = (event.nativeEvent as InputEvent).data;

            if (event.target.value === "") {
              const next = [...digits];
              next[index] = "";
              commit(next);
              return;
            }

            fill(index, inserted?.length === 1 ? inserted : event.target.value);
          }}
          onPaste={(event) => {
            event.preventDefault();
            fill(index, event.clipboardData.getData("text"));
          }}
          onKeyDown={(event) => {
            if (event.key === "Backspace" && digit === "" && index > 0) {
              event.preventDefault();
              const next = [...digits];
              next[index - 1] = "";
              commit(next);
              inputs.current[index - 1]?.focus();
            }
          }}
          className={cn(
            "h-control-lg aspect-square min-w-0 rounded-md border border-input bg-input-background text-center font-mono text-heading",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        />
      ))}
      <input type="hidden" name={name} value={digits.join("")} />
    </div>
  );
}
