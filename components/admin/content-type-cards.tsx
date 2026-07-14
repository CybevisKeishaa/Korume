import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CONTENT_TYPE_DESCRIPTIONS, CONTENT_TYPE_LABELS } from "./content-fields";
import { CONTENT_TYPES } from "@/lib/admin-ui-types";

/** Static landing grid for `/admin/content` — one card per content type,
 * linking to `/admin/content/[type]`. No fetch needed: the five types are
 * fixed (`CONTENT_TYPES`). */
export function ContentTypeCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {CONTENT_TYPES.map((type) => (
        <Link key={type} href={`/admin/content/${type}`} className="group">
          <Card className="h-full transition-colors group-hover:border-primary">
            <CardHeader>
              <CardTitle>{CONTENT_TYPE_LABELS[type]}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{CONTENT_TYPE_DESCRIPTIONS[type]}</CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
