// A local stand-in for Azure's short-audio recognition endpoint (plan Task 14). The app reaches it through
// AZURE_SPEECH_RECOGNITION_URL, which lib/speech-scoring/config.ts accepts only on a loopback host.
//
//   POST /recognize  answers per the current mode
//   POST /__mode     { "mode": "success" | "429" | "429-no-header" | "503" | "slow" }  (default success)
//   GET  /__calls    { "calls": n } — how many /recognize requests arrived
//
// The words cover the seeded line 1, 今日は1番目の文を読みます。 (tests/e2e/fixtures/workspace-data.ts), so the
// alignment clears its coverage floor and 文 carries the one Mispronunciation.
import { createServer } from "node:http";

const PORT = Number(process.env.SPEECH_STUB_PORT ?? 3999);
const TEXT = "今日は1番目の文を読みます。";
const word = (Word, AccuracyScore, ErrorType = "None") => ({ Word, PronunciationAssessment: { AccuracyScore, ErrorType } });
const SUCCESS = {
  RecognitionStatus: "Success",
  DisplayText: TEXT,
  NBest: [{
    Display: TEXT,
    PronunciationAssessment: { PronScore: 86, FluencyScore: 80, AccuracyScore: 88, CompletenessScore: 100 },
    Words: [word("今日", 90), word("は", 90), word("1", 90), word("番目", 90), word("の", 90), word("文", 40, "Mispronunciation"), word("を", 90), word("読みます", 90)],
  }],
};

let mode = "success";
let calls = 0;

function json(response, status, body, headers = {}) {
  response.writeHead(status, { "Content-Type": "application/json", ...headers });
  response.end(JSON.stringify(body));
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

createServer(async (request, response) => {
  const path = new URL(request.url ?? "/", "http://stub").pathname;
  if (request.method === "GET" && path === "/") return json(response, 200, { ok: true }); // Playwright's readiness probe
  if (request.method === "GET" && path === "/__calls") return json(response, 200, { calls });
  if (request.method === "POST" && path === "/__mode") {
    mode = JSON.parse((await readBody(request)) || "{}").mode ?? "success";
    return json(response, 200, { mode });
  }
  if (request.method === "POST" && path === "/recognize") {
    await readBody(request);
    calls += 1;
    if (mode === "503") return json(response, 503, { error: "unavailable" });
    if (mode === "429") return json(response, 429, { error: "throttled" }, { "Retry-After": "12" });
    if (mode === "429-no-header") return json(response, 429, { error: "throttled" });
    if (mode === "slow") await new Promise((resolve) => setTimeout(resolve, 35_000)); // past the app's 30 s timeout
    return json(response, 200, SUCCESS);
  }
  json(response, 404, { error: "not found" });
}).listen(PORT, "127.0.0.1", () => console.log(`speech stub on http://127.0.0.1:${PORT}`));
