const rawUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

if (!rawUrl) {
  if (process.env.NODE_ENV !== "production") {
    throw new Error("NEXT_PUBLIC_API_URL is not set");
  }
}

const normalizeBaseUrl = (url?: string | null) => {
  if (!url) return undefined;
  return url.endsWith("/") ? url.slice(0, -1) : url;
};

// Use /api proxy route to avoid CORS issues
// The Next.js rewrite in next.config.ts will proxy /api/* to the actual API
const environment = {
  API_URL: normalizeBaseUrl(rawUrl),
} as const;

export default environment;
