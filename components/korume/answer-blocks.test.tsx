import { describe, expect, it } from "vitest";
import { render } from "@/test/render";
import type { Answer } from "@/lib/korume/answer";
import { AnswerBlocks } from "./answer-blocks";

const show = (answer: Answer) => render(<AnswerBlocks answer={answer} grounding={[]} />);

describe("AnswerBlocks", () => {
  it("renders a v1 answer exactly as before", () => {
    const { container } = show({
      blocks: [
        { type: "paragraph", runs: [{ text: "Use " }, { jp: "は" }, { text: "bold", strong: true }] },
        { type: "example", jp: "私は学生です", ruby: [], translation: "I am a student" },
        { type: "followups", chips: ["Why?"] },
      ],
    });
    expect(container.innerHTML).toMatchSnapshot();
  });
});
