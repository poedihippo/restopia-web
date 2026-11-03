import type { NextConfig } from "next";

// /v1/* is proxied to NEXT_PUBLIC_API_URL by middleware.ts, not by
// rewrites() here — the backend's nginx/WAF 403s any request carrying an
// Origin header, and (a) rewrites() forwards the browser's Origin through
// unmodified, and (b) its :path* wildcard silently drops trailing slashes,
// which this backend also cares about (e.g. /auth/token/). middleware.ts
// proxies manually so it can strip Origin/Referer/Host and preserve the
// exact path.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Self-contained server bundle for the Docker image (ignored by Vercel).
  output: 'standalone',
  // Let the backend own trailing-slash redirects on /v1/* itself, since
  // Next's own trailing-slash redirect would otherwise fight it.
  skipTrailingSlashRedirect: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'music-school-production.s3.ap-southeast-1.amazonaws.com',
      },
    ]
  },
};

export default nextConfig;
