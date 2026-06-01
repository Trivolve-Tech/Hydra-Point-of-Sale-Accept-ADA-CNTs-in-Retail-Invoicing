/**
 * Client-only bridge: subscribes to Mesh's useWallet() and forwards the state
 * up via onChange. The customer page never imports @meshsdk/react directly —
 * importing it at the top of a page module makes Next's build try to load
 * Mesh's WASM bundle on the server. This file is loaded via next/dynamic with
 * ssr:false so the WASM never reaches the server bundle.
 */
import { useEffect } from "react";
import { useWallet } from "@meshsdk/react";

export type WalletState = {
  wallet: unknown;
  connected: boolean;
  name: string | null;
};

type Props = {
  onChange: (s: WalletState) => void;
};

export default function WalletBridge({ onChange }: Props) {
  const mesh = useWallet() as { wallet?: unknown; connected?: boolean; name?: string };
  useEffect(() => {
    onChange({
      wallet: mesh.wallet ?? null,
      connected: !!mesh.connected,
      name: typeof mesh.name === "string" ? mesh.name : null,
    });
  }, [mesh.wallet, mesh.connected, mesh.name, onChange]);
  return null;
}
