// Stub for the bare `server-only` import specifier so Vitest can load
// server-only modules (lib/ai, lib/data). In production Next.js resolves
// `server-only` to a module that throws if imported from a client bundle;
// under test there is no client bundle, so an empty module is correct.
export {};
