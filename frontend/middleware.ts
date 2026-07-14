import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, verifySessionToken } from "./app/lib/jwt";

/**
 * Route gate (FR-AUTH-004.2 — unauthenticated users can't reach protected pages).
 * Runs on the Edge runtime, so it only verifies the signed session token; no DB
 * or bcrypt here (that's why jwt.ts is dependency-light).
 *
 * - Auth pages (/login, /register) redirect to the dashboard when already signed in.
 * - Protected pages redirect to /login (preserving the intended path in `next`).
 * - Protected API routes return 401 JSON rather than an HTML redirect.
 * - /api/auth/* is always open (that's how you sign in).
 */

const AUTH_PAGES = ["/login", "/register"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // The auth API must stay reachable while signed out.
  if (pathname.startsWith("/api/auth")) return NextResponse.next();

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  const isAuthPage = AUTH_PAGES.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (isAuthPage) {
    if (session) return NextResponse.redirect(new URL("/", req.url));
    return NextResponse.next();
  }

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    if (pathname !== "/") loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
