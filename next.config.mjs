import createNextIntlPlugin from "next-intl/plugin";
import path from "node:path";

const withNextIntl = createNextIntlPlugin("./lib/i18n/request.ts");

const NODE_INSTRUMENTATION_EXTERNALS = new Set([
  "path",
  "node:path",
  "fs",
  "node:fs",
  "zlib",
  "node:zlib",
]);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    instrumentationHook: true,
    serverComponentsExternalPackages: ["kuromoji"],
  },
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
    if (nextRuntime !== "nodejs") {
      config.resolve.alias["@anthropic-ai/sdk"] = false;
      // The lesson-creation worker is also behind instrumentation.ts'
      // NEXT_RUNTIME=nodejs guard. Non-Node compilation can still follow the
      // dynamic import target and would otherwise bundle kuromoji's Node-only
      // dictionary loader (`path` / `node:path`) even though only the Node
      // runtime ever starts the worker.
      config.resolve.alias["@/lib/lesson-creation/start"] = false;
      // Instrumentation's SWC transform resolves the `@/` import to a
      // filesystem request before webpack applies aliases, so cover that
      // request form as well. The Node compiler intentionally leaves both
      // aliases absent and retains the real startup import.
      config.resolve.alias[path.resolve(process.cwd(), "lib/lesson-creation/start")] = false;
    }
    if (nextRuntime === "nodejs") {
      const nodeBuiltinAliases = {
        path: path.resolve(process.cwd(), "lib/node-builtins/path.cjs"),
        "node:path": path.resolve(process.cwd(), "lib/node-builtins/path.cjs"),
        fs: path.resolve(process.cwd(), "lib/node-builtins/fs.cjs"),
        "node:fs": path.resolve(process.cwd(), "lib/node-builtins/fs.cjs"),
        zlib: path.resolve(process.cwd(), "lib/node-builtins/zlib.cjs"),
        "node:zlib": path.resolve(process.cwd(), "lib/node-builtins/zlib.cjs"),
      };
      Object.assign(config.resolve.alias, nodeBuiltinAliases);
      config.externalsPresets = { ...config.externalsPresets, node: true };
      const externalizeNodeInstrumentationBuiltins = ({ request }, callback) => {
        if (NODE_INSTRUMENTATION_EXTERNALS.has(request)) {
          callback(null, `commonjs ${request}`);
          return;
        }
        callback();
      };
      const existingExternals = Array.isArray(config.externals)
        ? config.externals
        : config.externals
          ? [config.externals]
          : [];
      config.externals = [...existingExternals, externalizeNodeInstrumentationBuiltins];
    }
    return config;
  },
  // Spec §3.1.1. Every rule below is TEMPORARY (307), not permanent: a 308 is
  // cached hard by browsers, turning a later change into a debugging trap that
  // presents as an app routing bug. No SEO argument on the other side: every
  // one of these routes is auth-gated, and the app has never been published,
  // so no external inbound link exists to preserve.
  //
  // ⚠️ Scoped to the THREE `/videos` rules: those routes still move — Plan D
  // restructures the lesson workspace into four Learning Modes — so revisit
  // them at launch, and a wildcard is wrong for them because the middle one
  // (`/videos/:id/shadowing` -> `/shadowing/:id`) COLLAPSES a segment rather
  // than renaming a prefix. Neither point carries over to the `/jlpt` rule,
  // which is a prefix rename with its own removal condition; see its own
  // comment at that rule.
  //
  // `:locale` MUST stay constrained to the real locales. An unconstrained
  // `/:locale/videos` matches ANY first segment — including `api`, which made
  // the real endpoint `app/api/videos/route.ts` answer `307 -> /api/shadowing`
  // and then 404, in direct contradiction of spec §3.1 ("Not renamed:
  // /api/videos/**"). `redirects()` runs BEFORE the filesystem, so no route
  // handler and no middleware matcher can save it.
  //
  // The alternation duplicates `routing.locales` from `lib/i18n/routing.ts`,
  // because this file cannot import a `.ts` module. `next.config.test.ts`
  // asserts the two agree — add a locale there and that test fails here.
  async redirects() {
    return [
      { source: "/:locale(vi|en)/videos", destination: "/:locale/shadowing", permanent: false },
      {
        source: "/:locale(vi|en)/videos/:id/shadowing",
        destination: "/:locale/shadowing/:id",
        permanent: false,
      },
      {
        source: "/:locale(vi|en)/videos/:id/dictation",
        destination: "/:locale/shadowing/:id/dictation",
        permanent: false,
      },
      // Phase 2b / A9: /jlpt -> /certification. A WILDCARD is correct here,
      // unlike the /videos rules above: this renames a PREFIX, so one rule
      // covers /jlpt and /jlpt/[id]. Of the three /videos rules above, only
      // the middle one (/videos/:id/shadowing -> /shadowing/:id) COLLAPSES a
      // segment rather than renaming a prefix — that single rule is why all
      // three are enumerated instead of sharing one wildcard; the other two
      // would each have been fine with one. See that section's own comment
      // above, which already says this about the middle rule specifically.
      //
      // TEMPORARY, with a removal condition (A17): remove once the app is
      // published and one release has passed, or at launch if no /jlpt traffic
      // is observed. Task 7 records this condition in decision-register.md so
      // this cannot become the next /jlpt-test — a dead redirect nobody could
      // justify two phases on.
      {
        source: "/:locale(vi|en)/jlpt/:path*",
        destination: "/:locale/certification/:path*",
        permanent: false,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
