import { NextRequest, NextResponse } from "next/server";
import { accessMode, isAuthedRequest } from "./lib/server/auth";

const LOCKED_MESSAGE =
  "Resume Curator is locked: set APP_PASSWORD (or ALLOW_OPEN_ACCESS=true) in the deployment's environment variables.";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAsset =
    pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname.startsWith("/fonts");
  if (isAsset) return NextResponse.next();

  if (accessMode() === "locked") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: LOCKED_MESSAGE }, { status: 503 });
    }
    return new NextResponse(LOCKED_MESSAGE, {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const isPublic = pathname === "/login" || pathname === "/api/login";
  if (isPublic) return NextResponse.next();

  if (!(await isAuthedRequest(request))) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
