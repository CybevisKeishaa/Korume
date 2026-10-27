/** Exact Figma vectors as alpha masks: colours follow the shared contrast tokens in either theme. */
export function PracticeGlyph({ name, large = false }: {
  name: "replay-native" | "play-take" | "intonation" | "bookmark" | "microphone"
    | "listening-replay-audio" | "listening-loop" | "listening-check-answer" | "listening-feedback-tip";
  large?: boolean;
}) {
  return <span aria-hidden="true" className={`${large ? "size-icon-lg" : "size-icon-sm"} inline-block shrink-0 bg-current`}
    style={{ maskImage: `url(/images/practice/${name}.svg)`, maskSize: "contain", maskRepeat: "no-repeat", maskPosition: "center" }} />;
}
