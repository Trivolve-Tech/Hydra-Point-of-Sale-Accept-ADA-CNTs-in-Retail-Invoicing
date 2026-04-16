import dynamic from "next/dynamic";

export const MeshWalletConnectLazy = dynamic(
  () => import("./MeshWalletConnect"),
  { ssr: false },
);

export const PayWithWalletButtonLazy = dynamic(
  () => import("./PayWithWalletButton"),
  { ssr: false },
);
