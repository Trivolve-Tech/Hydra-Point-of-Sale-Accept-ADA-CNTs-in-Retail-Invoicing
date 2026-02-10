import { type AppProps } from "next/app";
import {
  HydrationBoundary,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

import "~/styles/globals.css";
import { useState } from "react";

const MyApp = ({
  Component,
  pageProps,
}: AppProps<{ dehydratedState?: unknown }>) => {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <HydrationBoundary state={pageProps.dehydratedState}>
        <Component {...pageProps} />
      </HydrationBoundary>
    </QueryClientProvider>
  );
};

export default MyApp;
