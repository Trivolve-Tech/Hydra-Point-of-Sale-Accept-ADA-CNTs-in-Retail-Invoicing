import { useCallback, useMemo, useState } from "react";
import { BlockfrostProvider, Transaction } from "@meshsdk/core";
import { useWallet } from "@meshsdk/react";
import toast from "react-hot-toast";
import axios from "axios";

import {
  getBrowserBlockfrostProjectId,
  getMeshChainNetwork,
} from "~/lib/cardano-browser-config";

type Props = {
  recipientAddress: string;
  amountAda: number;
  txId: string;
  disabled?: boolean;
  onFallbackL1?: () => void;
};

export default function PayWithHydraButton({
  recipientAddress,
  amountAda,
  txId,
  disabled = false,
  onFallbackL1,
}: Props) {
  const { wallet, connected } = useWallet();
  const [submitting, setSubmitting] = useState(false);

  const projectId = useMemo(() => getBrowserBlockfrostProjectId(), []);
  const meshNetwork = useMemo(() => getMeshChainNetwork(), []);

  const onPay = useCallback(async () => {
    if (!projectId) {
      toast.error("Set NEXT_PUBLIC_BLOCKFROST_PROJECT_ID for payments.");
      return;
    }
    if (!connected || !wallet) {
      toast.error("Connect a CIP-30 wallet first.");
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

      const { data } = await axios.post<{
        success: boolean;
        transactionId?: string;
        error?: string;
        fallback?: string;
      }>("/api/hydra/submit", {
        tx_id: txId,
        cbor_hex: signed,
      });

      if (data.success) {
        toast.success("L2 payment confirmed instantly!");
      } else {
        toast.error(`L2 failed: ${data.error ?? "unknown"}. Falling back to L1.`);
        onFallbackL1?.();
      }
    } catch (e) {
      console.error(e);
      toast.error("L2 payment failed. Falling back to L1 on-chain.");
      onFallbackL1?.();
    } finally {
      setSubmitting(false);
    }
  }, [amountAda, connected, meshNetwork, onFallbackL1, projectId, recipientAddress, txId, wallet]);

  if (!projectId) {
    return (
      <p className="max-w-sm text-xs text-amber-200/90">
        In-browser pay: add{" "}
        <span className="font-mono">NEXT_PUBLIC_BLOCKFROST_PROJECT_ID</span>.
      </p>
    );
  }

  return (
    <button
      type="button"
      data-testid="mesh-pay-with-hydra"
      disabled={disabled || submitting || !recipientAddress || amountAda <= 0}
      onClick={() => void onPay()}
      className="rounded-xl border border-cyan-400/40 bg-cyan-500/15 px-4 py-2.5 text-sm font-[helvetica-bold] uppercase tracking-wide text-cyan-200 transition hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-45"
    >
      {submitting ? "Signing..." : "Pay via Hydra L2"}
    </button>
  );
}
