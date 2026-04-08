import { queryClient } from "@/hooks/query";
import { AuthProvider } from "@/hooks/useAuth";
import "@/styles/globals.css";
import "@/styles/pos-print.css";
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
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </QueryClientProvider>
  );
}
