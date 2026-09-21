export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div data-density="reference" className="min-h-dvh bg-background">{children}</div>;
}
