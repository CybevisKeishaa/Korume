import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // Playwright specs live in tests/e2e and run via `npm run test:e2e`.
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next", "tests/e2e"],
    // `next@14.2.35` ships no `exports` map. `next-intl` imports
    // `next/navigation` as a bare specifier without extension, causing Node's
    // native ESM resolver to fail. Inlining `next-intl` routes it through
    // Vite's resolver instead — critical for all ~62 test files using
    // NextIntlClientProvider.
    server: {
      deps: {
        inline: [/next-intl/],
      },
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      // `server-only` (used by lib/ai and lib/data) has no standalone package;
      // Next.js resolves it at build time. Map it to an empty stub so Vitest
      // can import server-only modules under test.
      "server-only": fileURLToPath(
        new URL("./test/stubs/server-only.ts", import.meta.url),
      ),
      // `next-intl/server`'s real implementation is gated behind the
      // `react-server` resolution condition, which Vitest's jsdom environment
      // never sets — every call would otherwise throw "not supported in
      // Client Components" before any component code runs. See
      // `test/stubs/next-intl-server.ts` for the full rationale.
      "next-intl/server": fileURLToPath(
        new URL("./test/stubs/next-intl-server.ts", import.meta.url),
      ),
    },
  },
});
