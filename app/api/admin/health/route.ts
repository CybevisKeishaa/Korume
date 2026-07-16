import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { checkHealth } from "@/lib/admin/health";

export async function GET() {
  // requireAdmin(), not isAdmin(): the ADMIN_EMAILS bootstrap promotion only
  // fires inside requireAdmin (see project conventions).
  const admin = await requireAdmin();
  if (!admin.ok) {
    const message = admin.status === 401 ? "Unauthorized" : "Forbidden";
    return NextResponse.json({ error: message }, { status: admin.status });
  }
  return NextResponse.json(await checkHealth());
}
