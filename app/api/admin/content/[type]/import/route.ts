import { NextResponse } from "next/server";
import { importContentCsv } from "@/lib/data/admin-content";
import { contentTypeSchema, csvImportBodySchema } from "@/lib/validation/admin-content";

export async function POST(request: Request, { params }: { params: { type: string } }) {
  const typeParsed = contentTypeSchema.safeParse(params.type);
  if (!typeParsed.success) {
    return NextResponse.json({ error: "Unknown content type" }, { status: 400 });
  }

  const text = await request.text();
  const bodyParsed = csvImportBodySchema.safeParse(text);
  if (!bodyParsed.success) {
    return NextResponse.json(
      { error: "Invalid CSV body", details: bodyParsed.error.flatten().formErrors },
      { status: 400 },
    );
  }

  const result = await importContentCsv(typeParsed.data, bodyParsed.data);
  if (!result.ok) {
    if (result.status === 429) {
      return NextResponse.json(
        { error: "Too many import requests, slow down" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(result.retryAfter / 1000)) } },
      );
    }
    const message = result.status === 401 ? "Unauthorized" : result.status === 403 ? "Forbidden" : "Invalid CSV";
    return NextResponse.json({ error: message }, { status: result.status });
  }

  return NextResponse.json({ data: result.data });
}
