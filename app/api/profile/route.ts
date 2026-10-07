import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeProfileSave, saveProfile, type SaveProfileInput } from "@/lib/data/profile-write";

const OPAQUE_ERROR = "Something went wrong. Please try again.";
// avatar input cap (2 MB, lib/profile/avatar.ts) plus headroom for the JSON part and multipart framing.
const MAX_BODY_BYTES = 2 * 1024 * 1024 + 64 * 1024;

// .strict(): a user id (or any other key) in the body is a 400, never forwarded. The session is the only identity.
const profileSchema = z
  .object({
    fields: z.record(z.string(), z.unknown()),
    preferences: z.record(z.string(), z.unknown()),
    avatar: z.enum(["keep", "replace", "remove"]),
  })
  .strict();

const retryAfter = (ms: number) => ({ "Retry-After": String(Math.ceil(ms / 1000)) });

export async function PATCH(request: Request): Promise<NextResponse> {
  // Next 14 caps nothing for route handlers, and Node never delivers more than the declared length, so a required
  // Content-Length is a hard cap. A chunked request (no header) is refused before a byte of it is read.
  const length = request.headers.get("content-length");
  if (length === null || !/^\d+$/.test(length)) {
    return NextResponse.json({ error: "Content-Length required" }, { status: 411 });
  }
  if (Number(length) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  // Auth and rate limit come BEFORE the body is buffered; the session user is the only identity saveProfile accepts.
  const auth = await authorizeProfileSave();
  if (!auth.ok) {
    return auth.status === 429
      ? NextResponse.json({ error: "Too many requests, slow down" }, { status: 429, headers: retryAfter(auth.retryAfter) })
      : NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const rawProfile = form.get("profile");
  let profile: unknown;
  try {
    profile = JSON.parse(typeof rawProfile === "string" ? rawProfile : "");
  } catch {
    return NextResponse.json({ error: "Invalid profile" }, { status: 400 });
  }
  const parsed = profileSchema.safeParse(profile);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) fields[String(issue.path[0] ?? "form")] ??= issue.message;
    return NextResponse.json({ error: "Invalid input", fields }, { status: 400 });
  }

  const file = form.get("avatar");
  const hasFile = file instanceof File;
  if ((parsed.data.avatar === "replace") !== hasFile) {
    return NextResponse.json({ error: "Invalid avatar", fields: { avatar: "mismatch" } }, { status: 400 });
  }

  const avatar: SaveProfileInput["avatar"] = hasFile
    ? { action: "replace", bytes: new Uint8Array(await file.arrayBuffer()), type: file.type }
    : { action: parsed.data.avatar === "remove" ? "remove" : "keep" };

  try {
    const result = await saveProfile({ fields: parsed.data.fields, preferences: parsed.data.preferences, avatar }, auth.user);
    if (result.ok) return NextResponse.json({ data: { avatarUrl: result.data.avatarUrl } });
    switch (result.status) {
      case 400:
        return NextResponse.json({ error: "Invalid input", fields: result.fields }, { status: 400 });
      case 409:
        return NextResponse.json({ error: "Username taken", fields: result.fields }, { status: 409 });
      case 413:
        return NextResponse.json({ error: "Photo is too large" }, { status: 413 });
      case 415:
        return NextResponse.json({ error: "Unsupported photo type" }, { status: 415 });
      case 422:
        return NextResponse.json({ error: "Photo could not be processed" }, { status: 422 });
    }
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side only; never in the response body.
    console.error("[api/profile] PATCH failed:", error);
    return NextResponse.json({ error: OPAQUE_ERROR }, { status: 500 });
  }
}
