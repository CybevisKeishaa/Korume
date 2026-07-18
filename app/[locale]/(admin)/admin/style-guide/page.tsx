import type { Metadata } from "next";
import { StyleGuide } from "@/components/style-guide/style-guide";

export const metadata: Metadata = { title: "Style guide" };

/**
 * D9 gate: this route lives under the (admin) group, whose layout enforces
 * requireAdmin() server-side (dev reaches it via the ADMIN_EMAILS bootstrap
 * admin). Dev/admin-only by construction — no extra gate logic.
 */
export default function StyleGuidePage() {
  return <StyleGuide />;
}
