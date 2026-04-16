import { type AppProps } from "next/app";
import {
  type DehydratedState,
  HydrationBoundary,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

import "@meshsdk/react/styles.css";
import "~/styles/globals.css";
import { useEffect, useState, type ComponentType } from "react";

type MeshProviderProps = { children: React.ReactNode };

/**
 * Do not statically import `@meshsdk/react` in `_app`: it pulls WASM/crypto into
 * the server compile and breaks `/`. Load `MeshProvider` only on the client.
 */
function ClientMeshProvider({ children }: { children: React.ReactNode }) {
  const [MeshP, setMeshP] = useState<ComponentType<MeshProviderProps> | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    void import("@meshsdk/react").then((m) => {
      if (!cancelled) setMeshP(() => m.MeshProvider);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!MeshP) return <>{children}</>;
  return <MeshP>{children}</MeshP>;
}

const MyApp = ({
  Component,
  pageProps,
}: AppProps<{ dehydratedState?: DehydratedState }>) => {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <ClientMeshProvider>
      <QueryClientProvider client={queryClient}>
        <HydrationBoundary state={pageProps.dehydratedState ?? undefined}>
          <Component {...pageProps} />
        </HydrationBoundary>
      </QueryClientProvider>
    </ClientMeshProvider>
  );
};

export default MyApp;
