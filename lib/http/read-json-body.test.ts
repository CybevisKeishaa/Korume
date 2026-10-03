import { describe, expect, it } from "vitest";
import { readJsonBody } from "./read-json-body";

const encoder = new TextEncoder();

function request(body: string, headers?: HeadersInit): Request {
  return new Request("http://localhost/test", { method: "POST", body, headers });
}

describe("readJsonBody", () => {
  it("accepts a body exactly at the byte cap", async () => {
    const body = '{"body":"abc"}';
    await expect(readJsonBody(request(body), encoder.encode(body).byteLength)).resolves.toEqual({ ok: true, value: { body: "abc" } });
  });

  it("refuses a Content-Length above the cap without reading the body", async () => {
    const body = '{"body":"abcd"}';
    await expect(readJsonBody(request(body, { "Content-Length": String(encoder.encode(body).byteLength) }), encoder.encode(body).byteLength - 1))
      .resolves.toEqual({ ok: false, status: 413 });
  });

  it("refuses a cap-plus-one body without Content-Length", async () => {
    const body = '{"body":"abcd"}';
    await expect(readJsonBody(request(body), encoder.encode(body).byteLength - 1)).resolves.toEqual({ ok: false, status: 413 });
  });

  it("refuses a streamed body when a lying Content-Length claims less", async () => {
    const body = '{"body":"abcd"}';
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(body.slice(0, 7)));
        controller.enqueue(encoder.encode(body.slice(7)));
        controller.close();
      },
    });
    // Node needs duplex for a stream body; the DOM RequestInit type does not declare it yet.
    const init = { method: "POST", body: stream, headers: { "Content-Length": "1" }, duplex: "half" } as RequestInit;
    await expect(readJsonBody(new Request("http://localhost/test", init), encoder.encode(body).byteLength - 1))
      .resolves.toEqual({ ok: false, status: 413 });
  });

  it("still answers 413 when cancelling the oversized stream fails", async () => {
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) { controller.enqueue(encoder.encode("x".repeat(64))); },
      cancel() { throw new Error("cancel failed"); },
    });
    const init = { method: "POST", body: stream, duplex: "half" } as RequestInit;
    await expect(readJsonBody(new Request("http://localhost/test", init), 100)).resolves.toEqual({ ok: false, status: 413 });
  });

  it("returns 400 for malformed JSON, an empty body, and a null body", async () => {
    await expect(readJsonBody(request("{"), 100)).resolves.toEqual({ ok: false, status: 400 });
    await expect(readJsonBody(request(""), 100)).resolves.toEqual({ ok: false, status: 400 });
    await expect(readJsonBody(new Request("http://localhost/test", { method: "POST" }), 100)).resolves.toEqual({ ok: false, status: 400 });
  });
});
