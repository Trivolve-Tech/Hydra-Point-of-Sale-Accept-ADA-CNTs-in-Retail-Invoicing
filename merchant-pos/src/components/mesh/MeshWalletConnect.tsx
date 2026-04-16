import { CardanoWallet } from "@meshsdk/react";

/**
 * CIP-30 wallet picker (Nami, Eternl, Lace, etc.) via Mesh React.
 * Load with `next/dynamic({ ssr: false })` from pages that run on the server first.
 */
export default function MeshWalletConnect() {
  return (
    <div
      className="mesh-wallet-connect flex flex-wrap items-center justify-end gap-2 [&_button]:font-[helvetica-medium]"
      data-testid="mesh-wallet-connect"
    >
      <CardanoWallet label="Connect wallet" isDark={true} />
    </div>
  );
}
