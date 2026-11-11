import { queryClient } from "@/hooks/query";
import { AuthProvider } from "@/hooks/useAuth";
import { useEffect } from "react";
import { installClickGuard } from "@/lib/clickGuard";
import { installLoadingGuard } from "@/lib/loadingGuard";
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

  // Submit buttons are held (disabled) while any on-screen query is still on
  // its first load, so nothing is saved before its data has arrived.
  useEffect(() => installLoadingGuard(document, queryClient), []);

  const isPos = router.pathname.startsWith('/pos');
  const noLayout = NO_LAYOUT_ROUTES.includes(router.pathname) || isPos;

  // POS renders without GlobalLayout, which is what turns the v2 design on
  // (<html data-ui="v2">: Inter, the modern palette). Turn it on here so POS
  // gets the same clean look; restore the previous value on the way out.
  useEffect(() => {
    if (!isPos) return;
    const root = document.documentElement;
    const previous = root.dataset.ui;
    root.dataset.ui = 'v2';
    return () => {
      if (previous) root.dataset.ui = previous;
      else delete root.dataset.ui;
    };
  }, [isPos]);

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
