import { NextResponse } from "next/server";
import { z } from "zod";
import { saveProfile, type SaveProfileInput } from "@/lib/data/profile-write";
import { routing } from "@/lib/i18n/routing";

const OPAQUE_ERROR = "Something went wrong. Please try again.";
// avatar input cap (2 MB, lib/profile/avatar.ts) plus headroom for the JSON part and multipart framing.
const MAX_BODY_BYTES = 2 * 1024 * 1024 + 64 * 1024;

// .strict(): a user id (or any other key) in the body is a 400, never forwarded. The session is the only identity.
const profileSchema = z
  .object({
    fields: z.record(z.string(), z.unknown()),
    preferences: z.record(z.string(), z.unknown()),
    avatar: z.enum(["keep", "replace", "remove"]),
    locale: z.enum(routing.locales),
  })
  .strict();

const retryAfter = (ms: number) => ({ "Retry-After": String(Math.ceil(ms / 1000)) });

/** The route sits outside the locale middleware, so the page the form was on (Referer) is the only "current locale". */
function requestLocale(request: Request): string | null {
  try {
    const first = new URL(request.headers.get("referer") ?? "").pathname.split("/")[1] ?? "";
    return (routing.locales as readonly string[]).includes(first) ? first : null;
  } catch {
    return null;
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
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
    return NextResponse.json({ error: "Invalid input", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const file = form.get("avatar");
  const hasFile = file instanceof File;
  if ((parsed.data.avatar === "replace") !== hasFile) {
    return NextResponse.json({ error: "Invalid avatar", fields: { avatar: ["mismatch"] } }, { status: 400 });
  }

  const avatar: SaveProfileInput["avatar"] = hasFile
    ? { action: "replace", bytes: new Uint8Array(await file.arrayBuffer()), type: file.type }
    : { action: parsed.data.avatar === "remove" ? "remove" : "keep" };

  try {
    const result = await saveProfile({ fields: parsed.data.fields, preferences: parsed.data.preferences, avatar });
    if (result.ok) {
      const current = requestLocale(request);
      return NextResponse.json({
        data: { avatarUrl: result.data.avatarUrl, localeChanged: current !== null && current !== parsed.data.locale },
      });
    }
    switch (result.status) {
      case 400:
        return NextResponse.json({ error: "Invalid input", fields: result.fields }, { status: 400 });
      case 409:
        return NextResponse.json({ error: "Username taken", fields: result.fields }, { status: 409 });
      case 429:
        return NextResponse.json({ error: "Too many requests, slow down" }, { status: 429, headers: retryAfter(result.retryAfter) });
      case 401:
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
