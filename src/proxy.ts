import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicRoutes = ["/"];

function normalizeBaseUrl(raw?: string): string {
  if (!raw) {
    throw new Error(
      "NEXT_PUBLIC_API_URL is missing. Set it in Vercel > Project Settings > Environment Variables."
    );
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("NEXT_PUBLIC_API_URL must be an absolute URL (http/https).");
  }
  const origin = url.origin.replace(/\/+$/, "");
  const pathname = url.pathname.replace(/\/+$/, "");
  return `${origin}${pathname}`;
}

const API_BASE = normalizeBaseUrl(process.env.NEXT_PUBLIC_API_URL);

// Headers that must never be forwarded to the upstream API as-is: Origin and
// Referer expose this dev server's own address, and the backend's nginx/WAF
// returns a bare 403 for ANY request carrying an Origin header (confirmed
// against both dcdev.albatech.id and the production dc.albatech.id — with no
// Origin header the request reaches the app; with one, it's blocked before
// it does). Host must be dropped too so the upstream sees its own host, not
// this dev server's. A plain next.config.ts rewrites() proxy forwards these
// headers through unmodified (that's what caused login to 403), and its
// :path* wildcard also silently drops trailing slashes the backend cares
// about (e.g. /auth/token/) — this proxy forwards manually instead so it can
// strip headers and preserve the exact path.
const STRIPPED_REQUEST_HEADERS = ["origin", "referer", "host"];

// Hop-by-hop / transport headers that must not be copied onto the outgoing
// response — fetch() already decodes any upstream content-encoding, so
// forwarding the original content-length/content-encoding would leave the
// browser waiting for bytes that don't arrive.
const STRIPPED_RESPONSE_HEADERS = [
  "content-encoding",
  "content-length",
  "connection",
  "keep-alive",
  "transfer-encoding",
];

async function proxyApiRequest(request: NextRequest) {
  const targetUrl = new URL(
    API_BASE + request.nextUrl.pathname.replace(/^\/v1/, "") + request.nextUrl.search
  );

  const headers = new Headers(request.headers);
  for (const name of STRIPPED_REQUEST_HEADERS) headers.delete(name);

  const hasBody = !["GET", "HEAD"].includes(request.method);

  const upstream = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
    redirect: "manual",
  });

  const responseHeaders = new Headers(upstream.headers);
  for (const name of STRIPPED_RESPONSE_HEADERS) responseHeaders.delete(name);

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/v1/")) {
    return proxyApiRequest(request);
  }

  const token = request.cookies.get("token")?.value;
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
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*|public).*)"],
};
