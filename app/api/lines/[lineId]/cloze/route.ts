import { loadLineCloze } from "@/lib/data/line-cloze";
import { lineAnswerRoute } from "../answer-route";

export const GET = lineAnswerRoute(loadLineCloze, "cloze");
