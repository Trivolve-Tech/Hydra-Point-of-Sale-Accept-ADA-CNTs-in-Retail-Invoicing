import Head from "next/head";
import Image from "next/image";
import { useState, useCallback } from "react";
import { useRouter } from "next/router";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import axios from "axios";
import QRCode from "react-qr-code";
import toast, { Toaster } from "react-hot-toast";
import { MdContentCopy } from "react-icons/md";

import Button from "~/components/button";

type PaymentData = {
  tx_id: string;
  amount: number;
  payment_address: string;
  settlement_layer: "L1" | "L2";
  hydra_status?: string;
  hydra_tx_id?: string;
  hydra_confirmed_at?: string;
  status: 0 | 1;
};

export default function CustomerPage() {
  const router = useRouter();
  const { tx } = router.query;
  const [confirmed, setConfirmed] = useState(false);

  const { data: payment, isLoading } = useQuery<PaymentData>({
    queryKey: ["customerPayment", tx],
    queryFn: async () => {
      const res = await axios.get(`/api/payment?tx=${tx as string}`);
      if (res.data.status === 1 || res.data.hydra_status === "confirmed") {
        setConfirmed(true);
      }
      return res.data;
    },
    enabled: !!tx,
    refetchInterval: confirmed ? false : 800,
  });

  const payMutation = useMutation({
    mutationFn: async () => {
      const res = await axios.post("/api/payment/simulate-confirm", {
        tx_id: tx as string,
      });
      return res.data;
    },
    onSuccess: () => {
      setConfirmed(true);
      toast.success("Payment confirmed via Hydra L2!");
    },
    onError: () => toast.error("Payment failed"),
  });

  const copyToClipboard = useCallback((text: string) => {
    void navigator.clipboard.writeText(text);
    toast.success("Copied!");
  }, []);

  const isL2 = payment?.settlement_layer === "L2";
  const isPending = !confirmed && payment?.status !== 1;

  if (!tx) {
    return (
      <>
        <Head>
          <title>Customer Payment — Hydra PoS</title>
        </Head>
        <main className="flex min-h-screen items-center justify-center bg-black text-white">
          <p className="text-secondary">No payment intent specified.</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>
          {confirmed ? "Payment Confirmed" : "Pay"} — Hydra PoS
        </title>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="flex min-h-screen flex-col items-center bg-black px-[5%] py-8 font-[helvetica-medium] font-medium leading-6 tracking-wide text-white">
        <Toaster
          position="top-center"
          toastOptions={{ style: { fontFamily: "helvetica-medium" } }}
        />

        {/* Header */}
        <div className="mb-8 flex w-[90vw] max-w-[560px] items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.svg"
              alt="logo"
              width={1000}
              height={1000}
              className="w-[36px]"
            />
            <h1 className="font-[offbit-dot-bold] text-xl leading-6">
              Customer Payment
            </h1>
          </div>
          {payment && (
            <div
              data-testid="customer-layer-badge"
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-[helvetica-bold] uppercase tracking-wider ${
                isL2
                  ? "border-cyan-400/30 bg-cyan-500/10 text-cyan-300"
                  : "border-white/10 bg-white/5 text-secondary"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  isL2 ? "bg-cyan-400 animate-pulse" : "bg-secondary/50"
                }`}
              />
              {isL2 ? "Hydra L2" : "L1 On-chain"}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="w-[90vw] max-w-[560px]">
          <AnimatePresence mode="wait">
            {isLoading && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center py-20"
              >
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
                <p className="mt-4 text-sm text-secondary">
                  Loading payment details...
                </p>
              </motion.div>
            )}

            {!isLoading && !confirmed && payment && (
              <PaymentView
                key="payment"
                payment={payment}
                isPaying={payMutation.isPending}
                onPay={() => payMutation.mutate()}
                onCopy={copyToClipboard}
              />
            )}

            {confirmed && payment && (
              <SuccessView key="success" payment={payment} />
            )}
          </AnimatePresence>
        </div>
      </main>
    </>
  );
}

/* ─── Payment View ─────────────────────────────────────────────────────── */

function PaymentView({
  payment,
  isPaying,
  onPay,
  onCopy,
}: {
  payment: PaymentData;
  isPaying: boolean;
  onPay: () => void;
  onCopy: (text: string) => void;
}) {
  const isL2 = payment.settlement_layer === "L2";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      <div
        className="relative overflow-hidden rounded-lg p-0.5"
        style={{
          background:
            "linear-gradient(295.17deg, rgba(21,21,21,0.16) 2.58%, rgba(255,255,255,0.07) 97.17%)",
        }}
      >
        <div
          className="absolute inset-0 z-10 h-full w-full"
          style={{
            background:
              "linear-gradient(179.77deg, rgba(0,0,0,0) 0.2%, #101010 99.8%)",
          }}
        />
        <div className="bg2 relative z-20 rounded-lg px-6 py-6" data-testid="customer-payment-card">
          {/* Amount */}
          <div className="mb-6 text-center" data-testid="customer-amount-display">
            <span className="text-sm uppercase tracking-widest text-secondary">
              Amount Due
            </span>
            <h2 className="mt-2 font-[offbit-dot-bold] text-4xl">
              {payment.amount} ADA
            </h2>
            {isL2 && (
              <p className="mt-2 text-xs text-cyan-400/80">
                Instant settlement via Hydra L2
              </p>
            )}
          </div>

          {/* QR Code */}
          <div className="mb-6 flex flex-col items-center" data-testid="customer-qr-section">
            <div className="rounded-xl bg-white p-4">
              <QRCode value={payment.payment_address} size={180} />
            </div>
            <span className="mt-3 text-[10px] uppercase tracking-widest text-secondary/50">
              Scan with any Cardano wallet
            </span>
          </div>

          {/* Payment Details */}
          <div className="mb-6 space-y-3 rounded-lg bg-[#181818] p-4" data-testid="customer-payment-details">
            <div className="flex items-center justify-between gap-2">
              <span className="shrink-0 text-xs text-secondary">Payment Address</span>
              <div className="flex items-center gap-1.5">
                <span
                  className="max-w-[220px] truncate font-mono text-xs text-white cursor-pointer"
                  data-testid="customer-address"
                  onClick={() => onCopy(payment.payment_address)}
                >
                  {payment.payment_address}
                </span>
                <button onClick={() => onCopy(payment.payment_address)}>
                  <MdContentCopy size={12} className="text-secondary hover:text-white" />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-secondary">Settlement</span>
              <span className={`text-xs font-[helvetica-bold] ${isL2 ? "text-cyan-300" : "text-white"}`}>
                {isL2 ? "Hydra L2 — Instant" : "L1 On-chain"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-secondary">Reference</span>
              <span className="font-mono text-[10px] text-secondary/60">
                {payment.tx_id.slice(0, 16)}...
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-secondary">Status</span>
              <span className="flex items-center gap-1.5 text-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-white/40 animate-pulse" />
                Awaiting Payment
              </span>
            </div>
          </div>

          {/* Pay Button */}
          <div data-testid="customer-pay-action">
            <Button
              onClick={onPay}
              disabled={isPaying}
              data-testid="btn-pay-hydra"
            >
              {isPaying ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                  Submitting to Hydra...
                </span>
              ) : (
                <>
                  ⚡ Pay {payment.amount} ADA via{" "}
                  {isL2 ? "Hydra L2" : "L1"}
                </>
              )}
            </Button>
          </div>

          {isL2 && (
            <p className="mt-3 text-center text-[10px] text-secondary/40">
              Transaction will be confirmed in ~380ms via Hydra state channel
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Success View ─────────────────────────────────────────────────────── */

function SuccessView({ payment }: { payment: PaymentData }) {
  const isL2 = payment.settlement_layer === "L2";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div
        className="relative overflow-hidden rounded-lg p-0.5"
        style={{
          background:
            "linear-gradient(295.17deg, rgba(21,21,21,0.16) 2.58%, rgba(255,255,255,0.07) 97.17%)",
        }}
      >
        <div
          className="absolute inset-0 z-10 h-full w-full"
          style={{
            background:
              "linear-gradient(179.77deg, rgba(0,0,0,0) 0.2%, #101010 99.8%)",
          }}
        />
        <div className="bg2 relative z-20 flex flex-col items-center rounded-lg px-6 py-12" data-testid="customer-success">
          {/* Animated checkmark */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
            className="mb-6 flex h-24 w-24 items-center justify-center rounded-full border-2 border-cyan-400/30 bg-cyan-500/10"
            data-testid="customer-success-check"
          >
            <motion.svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <motion.path
                d="M5 13l4 4L19 7"
                stroke="#22d3ee"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.5, delay: 0.4 }}
              />
            </motion.svg>
          </motion.div>

          <h2 className="mb-2 font-[offbit-dot-bold] text-3xl">
            Payment Confirmed
          </h2>

          {isL2 && (
            <span className="mb-4 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-[helvetica-bold] text-cyan-300">
              Settled via Hydra L2
            </span>
          )}
          {!isL2 && (
            <span className="mb-4 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-[helvetica-bold] text-secondary">
              Settled on L1
            </span>
          )}

          <div className="mb-6 w-full max-w-[350px] space-y-2.5 rounded-lg bg-[#181818] p-4" data-testid="customer-success-details">
            <div className="flex items-center justify-between">
              <span className="text-xs text-secondary">Amount Paid</span>
              <span className="font-[offbit-dot-bold] text-sm">
                {payment.amount} ADA
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-secondary">Settlement</span>
              <span className={`text-xs ${isL2 ? "text-cyan-300" : "text-white"}`}>
                {isL2 ? "Hydra L2 — Instant" : "L1 On-chain"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-secondary">Reference</span>
              <span className="font-mono text-[10px] text-secondary/60">
                {payment.tx_id.slice(0, 16)}...
              </span>
            </div>
          </div>

          <p className="flex items-center gap-2 text-sm text-secondary">
            Thank you for using
            <Image
              src="/logo.svg"
              alt="logo"
              width={1000}
              height={1000}
              className="inline w-[20px]"
            />
            Trivolve Ada Payment Gateway
          </p>
        </div>
      </div>
    </motion.div>
  );
}
