import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteContent, updateContent } from "@/lib/data/admin-content";
import { contentTypeSchema } from "@/lib/validation/admin-content";

export async function PATCH(request: Request, { params }: { params: { type: string; id: string } }) {
  const typeParsed = contentTypeSchema.safeParse(params.type);
  if (!typeParsed.success) {
    return NextResponse.json({ error: "Unknown content type" }, { status: 400 });
  }
  if (!z.string().uuid().safeParse(params.id).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = await updateContent(typeParsed.data, params.id, body);
  if (!result.ok) {
    if (result.status === 429) {
      return NextResponse.json(
        { error: "Too many requests, slow down" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(result.retryAfter / 1000)) } },
      );
    }
    if (result.status === 400) {
      return NextResponse.json({ error: "Invalid input", details: result.errors }, { status: 400 });
    }
    const message = result.status === 401 ? "Unauthorized" : result.status === 403 ? "Forbidden" : "Not found";
    return NextResponse.json({ error: message }, { status: result.status });
  }

  return NextResponse.json({ data: result.data });
}

export async function DELETE(_request: Request, { params }: { params: { type: string; id: string } }) {
  const typeParsed = contentTypeSchema.safeParse(params.type);
  if (!typeParsed.success) {
    return NextResponse.json({ error: "Unknown content type" }, { status: 400 });
  }
  if (!z.string().uuid().safeParse(params.id).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const result = await deleteContent(typeParsed.data, params.id);
  if (!result.ok) {
    if (result.status === 429) {
      return NextResponse.json(
        { error: "Too many requests, slow down" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(result.retryAfter / 1000)) } },
      );
    }
    const message = result.status === 401 ? "Unauthorized" : result.status === 403 ? "Forbidden" : "Not found";
    return NextResponse.json({ error: message }, { status: result.status });
  }

  return new NextResponse(null, { status: 204 });
}
