import { Link } from "@/lib/i18n/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { contentTypeDescription, contentTypeLabel } from "./content-fields";
import { CONTENT_TYPES } from "@/lib/admin-ui-types";
import { useTranslations } from "@/lib/i18n";

/** Static landing grid for `/admin/content` — one card per content type,
 * linking to `/admin/content/[type]`. No fetch needed: the five types are
 * fixed (`CONTENT_TYPES`). */
export function ContentTypeCards() {
  const t = useTranslations("admin");

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {CONTENT_TYPES.map((type) => (
        <Link key={type} href={`/admin/content/${type}`} className="group">
          <Card className="h-full transition-colors group-hover:border-primary">
            <CardHeader>
              <CardTitle>{contentTypeLabel(t, type)}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {contentTypeDescription(t, type)}
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
