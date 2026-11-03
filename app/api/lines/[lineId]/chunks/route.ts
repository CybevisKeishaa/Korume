import { loadLineChunks } from "@/lib/data/line-chunks";
import { lineAnswerRoute } from "../answer-route";

export const GET = lineAnswerRoute(loadLineChunks, "chunks");
