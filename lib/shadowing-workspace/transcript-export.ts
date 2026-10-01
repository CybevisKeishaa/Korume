import type { WorkspaceLine } from "./types";

const timestamp = (seconds: number): string => {
  const milliseconds = Math.round(seconds * 1000);
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor(milliseconds % 3_600_000 / 60_000);
  const wholeSeconds = Math.floor(milliseconds % 60_000 / 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(wholeSeconds).padStart(2, "0")},${String(milliseconds % 1000).padStart(3, "0")}`;
};

export function toSrt(lines: readonly WorkspaceLine[], duration: number | null): string {
  return lines.map((line, index) => {
    const end = Math.max(line.startTime, line.endTime ?? lines[index + 1]?.startTime ?? duration ?? line.startTime + 2);
    return `${index + 1}\n${timestamp(line.startTime)} --> ${timestamp(end)}\n${line.textJp}`;
  }).join("\n\n");
}

export function toPlainText(lines: readonly WorkspaceLine[]): string {
  return lines.map((line) => line.textTranslation === null ? line.textJp : `${line.textJp}\n${line.textTranslation}`).join("\n\n");
}
