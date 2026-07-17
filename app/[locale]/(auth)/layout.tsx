import { Link } from "@/lib/i18n/navigation";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="p-4">
        <Link href="/" className="font-jp text-lg font-bold">
          日本語シネマ
        </Link>
      </header>
      {children}
    </div>
  );
}
