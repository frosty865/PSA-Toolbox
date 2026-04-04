(function () {
  const host = window.location.hostname;
  const protocol = window.location.protocol;
  const isStandaloneFile = protocol === "file:";
  const isLocalHost = /^(localhost|127\.0\.0\.1)$/.test(host);
  const enforceLocalAuth = window.TSP_ENFORCE_LOCAL_AUTH === true || window.TSP_ENFORCE_LOCAL_AUTH === "1";
  const localSignIn = (window.TSP_LOCAL_AUTH_URL || "http://localhost:3001").replace(/\/$/, "");
  const rootSignIn = (window.TSP_ROOT_SIGNIN_URL || (isLocalHost ? `${localSignIn}/auth/signin` : "")).replace(
    /\/$/,
    ""
  );

  const blocker = document.createElement("style");
  blocker.textContent = "html[data-workspace-auth='pending'] body { visibility: hidden; }";
  document.head.appendChild(blocker);
  document.documentElement.dataset.workspaceAuth = "pending";

  function hasSharedWorkspaceCookie() {
    return /(?:^|;\s*)(?:mp-auth=1|sb-access-token=)/.test(document.cookie);
  }

  async function ensureWorkspaceSession() {
    // Standalone deployments (opened directly from disk) must run without authentication.
    if (isStandaloneFile && !enforceLocalAuth) {
      document.documentElement.dataset.workspaceAuth = "ready";
      blocker.remove();
      return;
    }

    if (isLocalHost && !enforceLocalAuth) {
      document.documentElement.dataset.workspaceAuth = "ready";
      blocker.remove();
      return;
    }

    if (hasSharedWorkspaceCookie()) {
      document.documentElement.dataset.workspaceAuth = "ready";
      blocker.remove();
      return;
    }

    if (!rootSignIn) {
      document.documentElement.dataset.workspaceAuth = "ready";
      blocker.remove();
      return;
    }

    const signInUrl = new URL(rootSignIn);
    signInUrl.searchParams.set("redirectTo", window.location.href);
    window.location.replace(signInUrl.toString());
  }

  ensureWorkspaceSession();
})();
