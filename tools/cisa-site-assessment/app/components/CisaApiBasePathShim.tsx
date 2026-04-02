"use client";

import { useLayoutEffect } from "react";

const BASE_PATH = "/cisa-site-assessment";
const FETCH_MARK = Symbol.for("psa.cisa.fetch.basePathShim");

function prefixApiPath(input: string): string {
  if (!input.startsWith("/api/")) return input;
  return `${BASE_PATH}${input}`;
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
        return originalFetch(prefixApiPath(input), init);
      }

      if (input instanceof URL) {
        const nextUrl = new URL(input.href);
        if (nextUrl.pathname.startsWith("/api/")) {
          nextUrl.pathname = `${BASE_PATH}${nextUrl.pathname}`;
        }
        return originalFetch(nextUrl, init);
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
