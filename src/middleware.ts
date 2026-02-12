import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicRoutes = ["/"];

export function middleware(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  const { pathname } = request.nextUrl;

  const isPublicRoute = publicRoutes.some((route) => route === pathname);

  if (!token && !isPublicRoute) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (token && isPublicRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|v1|_next/static|_next/image|favicon.ico|.*\\..*|public).*)"],
};
