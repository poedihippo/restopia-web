import { queryClient } from "@/hooks/query";
import { AuthProvider } from "@/hooks/useAuth";
import { useEffect } from "react";
import { installClickGuard } from "@/lib/clickGuard";
import "@/styles/globals.css";
import "@/styles/pos-print.css";
import "@/styles/ui-v2.css";
import { QueryClientProvider } from "@tanstack/react-query";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { Toaster } from "sonner";
import GlobalLayout from "@/components/global-layout";

const NO_LAYOUT_ROUTES: string[] = [
  '/',
  '/pos',
];

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  // Global double-click guard: no button can fire twice within 350ms.
  // Covers every route, including the layout-less / and /pos pages.
  useEffect(() => installClickGuard(document), []);

  const noLayout =
    NO_LAYOUT_ROUTES.includes(router.pathname) ||
    router.pathname.startsWith('/pos');

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {noLayout ? (
          <Component {...pageProps} />
        ) : (
          <GlobalLayout>
            <Component {...pageProps} />
          </GlobalLayout>
        )}
        <Toaster closeButton position="top-right" richColors />
      </AuthProvider>
    </QueryClientProvider>
  );
}
