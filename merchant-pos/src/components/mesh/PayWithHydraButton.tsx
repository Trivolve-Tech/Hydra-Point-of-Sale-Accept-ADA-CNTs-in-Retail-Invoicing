import { useCallback, useMemo, useState } from "react";
import { Transaction } from "@meshsdk/core";
import { useWallet } from "@meshsdk/react";
import toast from "react-hot-toast";
import axios from "axios";

import { HydraHeadFetcher } from "~/lib/in-head-fetcher";
import { getMeshChainNetwork } from "~/lib/cardano-browser-config";

type Props = {
  recipientAddress: string;
  amountAda: number;
  /** Head id to route through. Omit to use the dev solo head. */
  headId?: string;
  disabled?: boolean;
  onConfirmed?: (transactionId?: string) => void;
  onFallbackL1?: () => void;
};

export default function PayWithHydraButton({
  recipientAddress,
  amountAda,
  headId,
  disabled = false,
  onConfirmed,
  onFallbackL1,
}: Props) {
  const { wallet, connected } = useWallet();
  const [submitting, setSubmitting] = useState(false);
  const meshNetwork = useMemo(() => getMeshChainNetwork(), []);

  const onPay = useCallback(async () => {
    if (!connected || !wallet) {
      toast.error("Connect a CIP-30 wallet first.");
      return;
    }
    if (!recipientAddress || amountAda <= 0) {
      toast.error("Missing payment address or amount.");
      return;
    }

    const lovelace = Math.round(amountAda * 1_000_000).toString();
    const fetcher = new HydraHeadFetcher({ headId });

    setSubmitting(true);
    try {
      const tx = new Transaction({
        initiator: wallet,
        fetcher,
        isHydra: true,
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
        cbor_hex: signed,
        ...(headId ? { head_id: headId } : {}),
      });

      if (data.success) {
        toast.success("L2 payment confirmed.");
        onConfirmed?.(data.transactionId);
      } else {
        toast.error(`L2 failed: ${data.error ?? "unknown"}. Falling back to L1.`);
        onFallbackL1?.();
      }
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "L2 payment failed.");
      onFallbackL1?.();
    } finally {
      setSubmitting(false);
    }
  }, [
    amountAda,
    connected,
    headId,
    meshNetwork,
    onConfirmed,
    onFallbackL1,
    recipientAddress,
    wallet,
  ]);

  return (
    <button
      type="button"
      data-testid="mesh-pay-with-hydra"
      disabled={
        disabled || submitting || !connected || !recipientAddress || amountAda <= 0
      }
      onClick={() => void onPay()}
      className="rounded-xl border border-accent-blue-400/40 bg-accent-blue-500/15 px-4 py-2.5 text-sm font-[helvetica-bold] uppercase tracking-wide text-accent-blue-200 transition hover:bg-accent-blue-500/25 disabled:cursor-not-allowed disabled:opacity-45"
    >
      {submitting ? "Signing…" : "Pay via Hydra L2"}
    </button>
  );
}
