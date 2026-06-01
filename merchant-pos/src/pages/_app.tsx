import "~/styles/globals.css";
import "@meshsdk/react/styles.css";
import type { AppProps } from "next/app";
import dynamic from "next/dynamic";

// MeshProvider attaches to `window.cardano` (CIP-30); must be client-only so
// SSR doesn't blow up on `window`.
const MeshProvider = dynamic(
  () => import("@meshsdk/react").then((m) => m.MeshProvider),
  { ssr: false },
);

export default function App({ Component, pageProps }: AppProps) {
  return (
    <MeshProvider>
      <Component {...pageProps} />
    </MeshProvider>
  );
}
