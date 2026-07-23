import { Link } from "@/lib/i18n/navigation";
import { getTranslations } from "@/lib/i18n/server";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations("common");
  return (
    <div className="min-h-screen">
      <header className="p-4">
        <Link href="/" className="font-jp text-lg font-bold">
          {t("appNameJp")}
        </Link>
      </header>
      {children}
    </div>
  );
}
