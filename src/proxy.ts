import { NextResponse, type NextRequest } from "next/server";

// Next 16 renamed middleware.ts to proxy.ts.
//
// This is a cheap cookie-presence check only; it does NOT hit the database.
// The real authorization happens in each page and route via getUser(), which
// validates the token against the sessions table. Treat this purely as an
// early redirect. (The cookie name is repeated here rather than imported so
// the proxy bundle doesn't pull in the database client.)

const SESSION_COOKIE = "atlas_session";
const PUBLIC_PATHS = ["/login", "/api/health", "/manifest.webmanifest", "/apple-icon"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (!hasSession && !isPublic) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" && !request.nextUrl.search ? "" : `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// /api/import is left out of the matcher: the proxy buffers request bodies
// (10 MB by default) and spreadsheet uploads can be larger. That route checks
// the session itself, like every other route.
export const config = {
  matcher: ["/((?!_next/static|_next/image|api/import|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
