import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";
import { validateDoctrineOrThrow } from "./lib/validateDoctrine";

/** Config file directory — Turbopack must not infer `app/` as the repo root when this project lives under PSA Toolbox. */
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

// Validate doctrine files at build/startup time (public/doctrine manifest + required_files)
try {
  const doctrineDir = path.join(process.cwd(), "public", "doctrine");
  validateDoctrineOrThrow(doctrineDir);
  console.log("[DOCTRINE] Validation passed - all required doctrine files present");
} catch (error) {
  console.error("[DOCTRINE] Validation failed:", error);
  if (process.env.NODE_ENV === "production") {
    throw error;
  }
  console.warn("[DOCTRINE] Continuing in development mode despite validation failure");
}

/** Served under the unified PSA Toolbox dev server (port 3000) via reverse-proxy rewrites; local dev also uses :3001. */
const SITE_BASE = "/cisa-site-assessment";

const nextConfig: NextConfig = {
  /** Exposed to client bundles for `apiUrl()`; must match `basePath`. */
  env: {
    NEXT_PUBLIC_BASE_PATH: SITE_BASE,
  },
  basePath: SITE_BASE,
  /**
   * Must match tools/dependency-analysis/apps/web (trailingSlash: true).
   * If PSA strips `/cisa-site-assessment/` → `/cisa-site-assessment` while IDA adds the slash,
   * the route-handler proxy on :3000 returns ERR_TOO_MANY_REDIRECTS.
   */
  trailingSlash: true,
  typescript: {
    ignoreBuildErrors: false,
  },

  // Prevent Next's output tracing from walking large on-disk trees that are
  // runtime data, not application code. (Next 16: use top-level, not experimental.)
  outputFileTracingExcludes: {
    "*": [
      "**/storage/**",
      "**/corpus_sources/**",
      "**/module_sources/**",
      "**/Dependencies/**",
      "**/Python/**",
      "**/.venv/**",
      "**/venv/**",
    ],
  },

  // Exclude scripts directory from build
  pageExtensions: ['ts', 'tsx', 'js', 'jsx'],

  turbopack: {
    root: projectRoot,
  },

  // Allow Google Maps API
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ];
  },

};

export default nextConfig;
