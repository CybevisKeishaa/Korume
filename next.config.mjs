import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./lib/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { instrumentationHook: true },
  images: {
    remotePatterns: [
      // YouTube thumbnails (metadata only — never proxying video, per CLAUDE.md §2)
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "img.youtube.com" },
    ],
  },
  webpack: (config, { nextRuntime }) => {
    // middleware.ts forces Next to also compile instrumentation.ts for the edge
    // runtime. Its register() dynamically imports lib/ai/registry.ts, which is
    // a no-op there (the NEXT_RUNTIME guard returns before anything executes) —
    // but webpack still has to bundle that dynamic-import target for the edge
    // build, and @anthropic-ai/sdk statically imports `node:fs`/`node:path`,
    // which the edge bundle cannot handle. It is unreachable at edge runtime,
    // so aliasing it away here only affects bundling, not behaviour.
    if (nextRuntime === "edge") {
      config.resolve.alias["@anthropic-ai/sdk"] = false;
    }
    return config;
  },
  // Spec §3.1.1. TEMPORARY (307), not permanent: these routes still move —
  // Plan D restructures the lesson workspace into four Learning Modes — and a
  // 308 is cached hard by browsers, turning a later change into a debugging
  // trap that presents as an app routing bug. No SEO argument on the other
  // side: every one of these routes is auth-gated, and the app has never been
  // published, so no external inbound link exists to preserve. Revisit at
  // launch. A wildcard is wrong here because the second rule COLLAPSES a
  // segment rather than renaming a prefix.
  async redirects() {
    return [
      { source: "/:locale/videos", destination: "/:locale/shadowing", permanent: false },
      {
        source: "/:locale/videos/:id/shadowing",
        destination: "/:locale/shadowing/:id",
        permanent: false,
      },
      {
        source: "/:locale/videos/:id/dictation",
        destination: "/:locale/shadowing/:id/dictation",
        permanent: false,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
