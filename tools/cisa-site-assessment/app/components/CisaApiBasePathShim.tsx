"use client";

import { useLayoutEffect } from "react";
import { ADMIN_API_TOKEN_HEADER } from "@/app/lib/admin/constants";
import { readAdminCookieFromDocument } from "@/app/lib/admin/client";

const BASE_PATH = "/cisa-site-assessment";
const FETCH_MARK = Symbol.for("psa.cisa.fetch.basePathShim");

function prefixApiPath(input: string): string {
  if (!input.startsWith("/api/")) return input;
  // Already prefixed (e.g. apiUrl() + basePath) — avoid /cisa-site-assessment/cisa-site-assessment/api/...
  if (input.startsWith(`${BASE_PATH}/api/`)) return input;
  return `${BASE_PATH}${input}`;
}

/** Ensure admin routes send cookie + explicit header (some proxies/CDNs strip cookies). */
function withAdminAuth(urlString: string, init?: RequestInit): RequestInit | undefined {
  if (!urlString.includes("/api/admin")) return init;
  const headers = new Headers(init?.headers);
  const token = readAdminCookieFromDocument();
  if (token && !headers.has(ADMIN_API_TOKEN_HEADER)) {
    headers.set(ADMIN_API_TOKEN_HEADER, token);
  }
  return {
    ...init,
    credentials: init?.credentials ?? "same-origin",
    headers,
  };
}

export default function CisaApiBasePathShim() {
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;

    const currentFetch = window.fetch as typeof window.fetch & {
      [FETCH_MARK]?: true;
    };
    if (currentFetch[FETCH_MARK]) return;

    const originalFetch = window.fetch.bind(window);

    const wrappedFetch: typeof window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      if (typeof input === "string") {
        const target = prefixApiPath(input);
        return originalFetch(target, withAdminAuth(target, init));
      }

      if (input instanceof URL) {
        const nextUrl = new URL(input.href);
        if (nextUrl.pathname.startsWith("/api/")) {
          nextUrl.pathname = `${BASE_PATH}${nextUrl.pathname}`;
        }
        return originalFetch(nextUrl, withAdminAuth(nextUrl.href, init));
      }

      return originalFetch(input, init);
    };

    Object.defineProperty(wrappedFetch, FETCH_MARK, {
      value: true,
      enumerable: false,
      configurable: false,
    });

    window.fetch = wrappedFetch;
  }, []);

  return null;
}
