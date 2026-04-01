import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_WORKSPACE_SIGNIN_URL,
  WORKSPACE_SESSION_COOKIE_NAMES,
  WORKSPACE_SESSION_COOKIE_PREFIX,
} from "./lib/workspaceAuth";

const rootSignInUrl =
  process.env.ROOT_SIGNIN_URL?.trim() ||
  process.env.NEXT_PUBLIC_ROOT_SIGNIN_URL?.trim() ||
  DEFAULT_WORKSPACE_SIGNIN_URL;

function hasWorkspaceSessionCookie(request: NextRequest) {
  return request.cookies
    .getAll()
    .some(
      ({ name }) =>
        WORKSPACE_SESSION_COOKIE_NAMES.includes(
          name as (typeof WORKSPACE_SESSION_COOKIE_NAMES)[number]
        ) ||
        name === WORKSPACE_SESSION_COOKIE_PREFIX ||
        name.startsWith(`${WORKSPACE_SESSION_COOKIE_PREFIX}.`),
    );
}

function redirectToWorkspaceSignIn(request: NextRequest) {
  const signInUrl = new URL(rootSignInUrl);
  signInUrl.searchParams.set("redirectTo", request.nextUrl.href);
  return NextResponse.redirect(signInUrl);
}

export default function proxy(request: NextRequest) {
  const hostname = request.nextUrl.hostname;
  const isPreviewHost = hostname.endsWith(".vercel.app");
  const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1";

  if (isPreviewHost || isLocalHost) {
    return NextResponse.next();
  }

  if (hasWorkspaceSessionCookie(request)) {
    return NextResponse.next();
  }

  return redirectToWorkspaceSignIn(request);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"],
};
