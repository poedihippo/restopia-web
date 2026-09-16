const rawUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

if (!rawUrl) {
  if (process.env.NODE_ENV !== "production") {
    throw new Error("NEXT_PUBLIC_API_URL is not set");
  }
}

// Use the /v1 proxy route to avoid CORS issues — the Next.js rewrite in
// next.config.ts forwards /v1/* server-side to NEXT_PUBLIC_API_URL, so the
// browser must call the relative path, never the absolute backend URL.
const environment = {
  API_URL: "/v1",
} as const;

export default environment;
