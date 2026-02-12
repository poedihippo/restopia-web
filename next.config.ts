import type { NextConfig } from "next";

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
    throw new Error(
      "NEXT_PUBLIC_API_URL must be an absolute URL (http/https)."
    );
  }
  const origin = url.origin.replace(/\/+$/, "");
  const pathname = url.pathname.replace(/\/+$/, "");
  return `${origin}${pathname}`;
}

const API_BASE = normalizeBaseUrl(process.env.NEXT_PUBLIC_API_URL);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/v1/:path*",
        destination: `${API_BASE}/:path*`,
      },
    ];
  },
};

export default nextConfig;
