import { queryClient } from "@/hooks/query";
import { AuthProvider } from "@/hooks/useAuth";
import "@/styles/globals.css";
import { QueryClientProvider } from "@tanstack/react-query";
import type { AppProps } from "next/app";
import { Toaster } from "sonner";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Component {...pageProps} />
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </QueryClientProvider>
  );
}
