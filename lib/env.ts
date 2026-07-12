/**
 * Typed access to environment variables. Public vars are safe in the browser;
 * server-only vars must NEVER be referenced from client components (CLAUDE.md §6).
 */

export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. See .env.local.example.`,
    );
  }
  return value;
}

export const publicEnv = {
  supabaseUrl: () => requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: () => requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
};

/**
 * Whether the public Supabase env is configured. Lets the app run (marketing +
 * auth pages) before .env.local exists, instead of crashing every route.
 */
export function hasPublicSupabaseEnv(): boolean {
  return (
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
