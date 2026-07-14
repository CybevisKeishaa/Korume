import { NextResponse } from "next/server";
import { createContent, listContent } from "@/lib/data/admin-content";
import { contentListQuerySchema, contentTypeSchema } from "@/lib/validation/admin-content";

export async function GET(request: Request, { params }: { params: { type: string } }) {
  const typeParsed = contentTypeSchema.safeParse(params.type);
  if (!typeParsed.success) {
    return NextResponse.json({ error: "Unknown content type" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const queryParsed = contentListQuerySchema.safeParse({
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
    search: searchParams.get("search") ?? undefined,
  });
  if (!queryParsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: queryParsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const result = await listContent(typeParsed.data, queryParsed.data);
  if (!result.ok) {
    const message = result.status === 401 ? "Unauthorized" : "Forbidden";
    return NextResponse.json({ error: message }, { status: result.status });
  }

  return NextResponse.json({ data: result.data });
}

export async function POST(request: Request, { params }: { params: { type: string } }) {
  const typeParsed = contentTypeSchema.safeParse(params.type);
  if (!typeParsed.success) {
    return NextResponse.json({ error: "Unknown content type" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = await createContent(typeParsed.data, body);
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
    const message = result.status === 401 ? "Unauthorized" : "Forbidden";
    return NextResponse.json({ error: message }, { status: result.status });
  }

  return NextResponse.json({ data: result.data }, { status: 201 });
}
