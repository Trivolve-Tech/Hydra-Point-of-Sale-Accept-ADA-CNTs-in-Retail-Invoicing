import { useCallback, useMemo, useState } from "react";
import { BlockfrostProvider, Transaction } from "@meshsdk/core";
import { useNetwork, useWallet } from "@meshsdk/react";
import toast from "react-hot-toast";

import {
  getBrowserBlockfrostProjectId,
  getMeshChainNetwork,
} from "~/lib/cardano-browser-config";

type Props = {
  recipientAddress: string;
  amountAda: number;
  disabled?: boolean;
};

export default function PayWithWalletButton({
  recipientAddress,
  amountAda,
  disabled = false,
}: Props) {
  const { wallet, connected } = useWallet();
  const walletNetwork = useNetwork();
  const [submitting, setSubmitting] = useState(false);

  const projectId = useMemo(() => getBrowserBlockfrostProjectId(), []);
  const meshNetwork = useMemo(() => getMeshChainNetwork(), []);

  const networkMatches =
    walletNetwork === undefined ||
    (meshNetwork === "mainnet" ? walletNetwork === 1 : walletNetwork === 0);

  const onPay = useCallback(async () => {
    if (!projectId) {
      toast.error(
        "Set NEXT_PUBLIC_BLOCKFROST_PROJECT_ID for in-browser payments.",
      );
      return;
    }
    if (!connected || !wallet) {
      toast.error("Connect a CIP-30 wallet first.");
      return;
    }
    if (!networkMatches) {
      toast.error(
        `Wallet network does not match app (${meshNetwork}). Switch networks in your wallet.`,
      );
      return;
    }
    if (!recipientAddress || amountAda <= 0) {
      toast.error("Missing payment address or amount.");
      return;
    }

    const lovelace = Math.round(amountAda * 1_000_000).toString();
    const provider = new BlockfrostProvider(projectId);

    setSubmitting(true);
    try {
      const tx = new Transaction({
        initiator: wallet,
        fetcher: provider,
        submitter: provider,
      })
        .setNetwork(meshNetwork)
        .sendLovelace(recipientAddress, lovelace);

      const unsigned = await tx.build();
      const signed = await wallet.signTx(unsigned);
      await wallet.submitTx(signed);
      toast.success("Transaction submitted. Confirmation may take a moment.");
    } catch (e) {
      console.error(e);
      toast.error(
        e instanceof Error ? e.message : "Could not build or submit transaction",
      );
    } finally {
      setSubmitting(false);
    }
  }, [
    amountAda,
    connected,
    meshNetwork,
    networkMatches,
    projectId,
    recipientAddress,
    wallet,
  ]);

  if (!projectId) {
    return (
      <p className="max-w-sm text-xs text-amber-200/90" data-testid="mesh-pay-env-hint">
        In-browser pay: add{" "}
        <span className="font-mono">NEXT_PUBLIC_BLOCKFROST_PROJECT_ID</span> (same
        network as the app).
      </p>
    );
  }

  return (
    <button
      type="button"
      data-testid="mesh-pay-with-wallet"
      disabled={disabled || submitting || !recipientAddress || amountAda <= 0}
      onClick={() => void onPay()}
      className="rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-[helvetica-bold] uppercase tracking-wide text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-45"
    >
      {submitting ? "Signing…" : "Pay with wallet"}
    </button>
  );
}
