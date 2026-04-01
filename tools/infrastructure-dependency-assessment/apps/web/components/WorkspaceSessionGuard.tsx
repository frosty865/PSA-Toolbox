"use client";

import { useEffect, useState } from "react";

/** Root SSO entry when unauthenticated. */
const rootSignInUrl =
  process.env.NEXT_PUBLIC_ROOT_SIGNIN_URL?.trim() || "";
const localAuthOrigin = "http://localhost:3001";
const enforceLocalAuth =
  (process.env.NEXT_PUBLIC_ENFORCE_LOCAL_AUTH?.trim() || "") === "1";

function isLocalHost() {
  return /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
}

function getDefaultRootSignInUrl() {
  return isLocalHost()
    ? `${localAuthOrigin}/auth/signin`
    : "https://www.example.com";
}

function buildSignInRedirect() {
  const url = new URL(rootSignInUrl || getDefaultRootSignInUrl());
  url.searchParams.set("redirectTo", window.location.href);
  return url.toString();
}

export function WorkspaceSessionGuard() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    function hasSharedWorkspaceCookie() {
      return /(?:^|;\s*)(?:mp-auth=1|sb-access-token=)/.test(document.cookie);
    }

    function verifyWorkspaceSession() {
      // Standalone default for local product runs.
      if (isLocalHost() && !enforceLocalAuth) {
        if (active) {
          setReady(true);
        }
        return;
      }

      if (!hasSharedWorkspaceCookie()) {
        window.location.replace(buildSignInRedirect());
        return;
      }

      if (active) {
        setReady(true);
      }
    }

    verifyWorkspaceSession();

    return () => {
      active = false;
    };
  }, []);

  if (ready) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white text-sm font-medium text-slate-700">
      Verifying workspace session...
    </div>
  );
}
