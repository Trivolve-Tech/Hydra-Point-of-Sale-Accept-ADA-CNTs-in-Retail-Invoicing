import Head from "next/head";
import Image from "next/image";
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import QRCode from "react-qr-code";
import toast, { Toaster } from "react-hot-toast";
import { MdDone, MdContentCopy } from "react-icons/md";
import { FiPlus } from "react-icons/fi";

import Button from "~/components/button";

type HydraStatus = {
  available: boolean;
  headState: string;
  headId?: string;
  connectionState: string;
};

type PaymentIntent = {
  tx_id: string;
  amount: number;
  payment_address: string;
  settlement_layer: "L1" | "L2";
  hydra_status?: string;
  hydra_tx_id?: string;
  hydra_confirmed_at?: string;
  l1_fallback_reason?: string;
  created_at: string;
  status?: number;
};

type HydraMetrics = {
  total_payments: number;
  l1_payments: number;
  l2_payments: number;
  avg_l1_confirmation_ms: number;
  avg_l2_confirmation_ms: number;
  l2_fallback_count: number;
};

type Invoice = {
  id: string;
  number: string;
  status: string;
  asset: { unit: string; quantity: string };
  customer?: { name?: string; email?: string };
  created_at: string;
};

type WsEvent = {
  type: string;
  timestamp: string;
  data?: string;
};

type MerchantView =
  | "dashboard"
  | "create-intent"
  | "intent-detail"
  | "invoices";

export default function MerchantPage() {
  const [view, setView] = useState<MerchantView>("dashboard");
  const [selectedIntent, setSelectedIntent] = useState<PaymentIntent | null>(
    null,
  );
  const [wsEvents, setWsEvents] = useState<WsEvent[]>([]);
  const [createAmount, setCreateAmount] = useState("");
  const [createCurrency, setCreateCurrency] = useState<"ADA" | "VND">("ADA");
  const [preferHydra, setPreferHydra] = useState(true);
  const [linkInvoice, setLinkInvoice] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const queryClient = useQueryClient();
  const eventsEndRef = useRef<HTMLDivElement>(null);

  const { data: hydraStatus } = useQuery<HydraStatus>({
    queryKey: ["hydraStatus"],
    queryFn: async () => (await axios.get("/api/hydra/status")).data,
    refetchInterval: 3000,
  });

  const { data: metrics } = useQuery<HydraMetrics>({
    queryKey: ["hydraMetrics"],
    queryFn: async () => (await axios.get("/api/hydra/metrics")).data,
    refetchInterval: 5000,
  });

  const { data: adaPrice } = useQuery<Record<string, number>>({
    queryKey: ["adaPrice"],
    queryFn: async () => (await axios.get("/api/adaprice")).data,
  });

  const { data: recentIntents } = useQuery<PaymentIntent[]>({
    queryKey: ["recentIntents"],
    queryFn: async () => (await axios.get("/api/merchant/intents")).data,
    refetchInterval: 2000,
  });

  const { data: invoices } = useQuery<Invoice[]>({
    queryKey: ["invoicesList"],
    queryFn: async () => {
      const res = await axios.get("/api/invoices?limit=20");
      return res.data.invoices ?? res.data;
    },
    enabled: view === "invoices",
  });

  useEffect(() => {
    if (!hydraStatus?.available) return;
    const addEvent = (type: string, data?: string) => {
      setWsEvents((prev) => [
        ...prev.slice(-49),
        { type, timestamp: new Date().toISOString(), data },
      ]);
    };
    addEvent(
      "HeadOpen",
      `Head ${hydraStatus.headId ?? "unknown"} — ${hydraStatus.headState}`,
    );
    const interval = setInterval(() => {
      addEvent("Heartbeat", "WebSocket alive");
    }, 8000);
    return () => clearInterval(interval);
  }, [hydraStatus?.available, hydraStatus?.headId, hydraStatus?.headState]);

  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [wsEvents]);

  const createIntentMutation = useMutation({
    mutationFn: async (params: {
      amount: number;
      prefer_hydra: boolean;
      link_invoice: boolean;
      customer?: { name?: string; email?: string };
      notes?: string;
    }) => {
      const res = await axios.post("/api/merchant/create-intent", params);
      return res.data as { intent: PaymentIntent; invoice?: Invoice };
    },
    onSuccess: (data) => {
      toast.success(
        data.intent.settlement_layer === "L2"
          ? "Hydra L2 payment intent created"
          : "L1 on-chain payment intent created",
      );
      setWsEvents((prev) => [
        ...prev.slice(-49),
        {
          type: "PaymentIntentCreated",
          timestamp: new Date().toISOString(),
          data: `${data.intent.amount} ADA → ${data.intent.settlement_layer}`,
        },
      ]);
      setSelectedIntent(data.intent);
      setView("intent-detail");
      void queryClient.invalidateQueries({ queryKey: ["recentIntents"] });
      void queryClient.invalidateQueries({ queryKey: ["hydraMetrics"] });
    },
    onError: () => toast.error("Failed to create payment intent"),
  });

  const handleCreateIntent = useCallback(() => {
    let adaAmount = parseFloat(createAmount);
    if (isNaN(adaAmount) || adaAmount <= 0) {
      toast.error("Invalid amount");
      return;
    }
    if (createCurrency === "VND" && adaPrice?.vnd) {
      adaAmount = parseFloat((adaAmount / adaPrice.vnd).toFixed(2));
    }
    createIntentMutation.mutate({
      amount: adaAmount,
      prefer_hydra: preferHydra,
      link_invoice: linkInvoice,
      customer:
        customerName || customerEmail
          ? { name: customerName || undefined, email: customerEmail || undefined }
          : undefined,
      notes: invoiceNotes || undefined,
    });
  }, [
    createAmount,
    createCurrency,
    adaPrice,
    preferHydra,
    linkInvoice,
    customerName,
    customerEmail,
    invoiceNotes,
    createIntentMutation,
  ]);

  const copyToClipboard = useCallback((text: string) => {
    void navigator.clipboard.writeText(text);
    toast.success("Copied!");
  }, []);

  return (
    <>
      <Head>
        <title>Merchant Dashboard — Hydra PoS</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="flex min-h-screen flex-col items-center bg-black px-[5%] py-8 font-[helvetica-medium] font-medium leading-6 tracking-wide text-white">
        <Toaster
          position="top-center"
          toastOptions={{ style: { fontFamily: "helvetica-medium" } }}
        />

        {/* Header */}
        <div className="mb-6 flex w-[90vw] max-w-[900px] items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.svg"
              alt="logo"
              width={1000}
              height={1000}
              className="w-[36px]"
            />
            <h1 className="font-[offbit-dot-bold] text-xl leading-6">
              Merchant Dashboard
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <HydraStatusPill status={hydraStatus} />
            <button
              data-testid="nav-create"
              onClick={() => setView("create-intent")}
              className="flex items-center gap-1.5 rounded-lg border border-white/20 bg-white px-4 py-2 font-[helvetica-bold] text-xs uppercase tracking-wide text-black transition hover:bg-white/90"
            >
              <FiPlus size={14} />
              New Payment
            </button>
          </div>
        </div>

        {/* Nav Tabs */}
        <nav
          className="mb-6 flex w-[90vw] max-w-[900px] gap-1 rounded-lg border border-[#232323] bg-[#0d0d0d] p-1"
          data-testid="merchant-nav"
        >
          {(
            [
              ["dashboard", "Dashboard"],
              ["create-intent", "Create Intent"],
              ["invoices", "Invoices"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              data-testid={`nav-${id}`}
              onClick={() => setView(id)}
              className={`rounded-md px-4 py-2 text-sm transition ${
                view === id
                  ? "bg-white/10 font-[helvetica-bold] text-white"
                  : "text-secondary hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="w-[90vw] max-w-[900px]">
          <AnimatePresence mode="wait">
            {view === "dashboard" && (
              <DashboardView
                key="dashboard"
                hydraStatus={hydraStatus}
                metrics={metrics}
                recentIntents={recentIntents}
                wsEvents={wsEvents}
                eventsEndRef={eventsEndRef}
                onOpenIntent={(i) => {
                  setSelectedIntent(i);
                  setView("intent-detail");
                }}
                onCreateNew={() => setView("create-intent")}
              />
            )}
            {view === "create-intent" && (
              <CreateIntentView
                key="create-intent"
                createAmount={createAmount}
                setCreateAmount={setCreateAmount}
                createCurrency={createCurrency}
                setCreateCurrency={setCreateCurrency}
                preferHydra={preferHydra}
                setPreferHydra={setPreferHydra}
                linkInvoice={linkInvoice}
                setLinkInvoice={setLinkInvoice}
                customerName={customerName}
                setCustomerName={setCustomerName}
                customerEmail={customerEmail}
                setCustomerEmail={setCustomerEmail}
                invoiceNotes={invoiceNotes}
                setInvoiceNotes={setInvoiceNotes}
                adaPrice={adaPrice}
                hydraAvailable={hydraStatus?.available ?? false}
                onSubmit={handleCreateIntent}
                isSubmitting={createIntentMutation.isPending}
              />
            )}
            {view === "intent-detail" && selectedIntent && (
              <IntentDetailView
                key="intent-detail"
                intent={selectedIntent}
                onBack={() => setView("dashboard")}
                onCopy={copyToClipboard}
              />
            )}
            {view === "invoices" && (
              <InvoicesView key="invoices" invoices={invoices} />
            )}
          </AnimatePresence>
        </div>
      </main>
    </>
  );
}

/* ─── Hydra Status Pill ─────────────────────────────────────────────────── */

function HydraStatusPill({ status }: { status?: HydraStatus }) {
  const available = status?.available ?? false;
  return (
    <div
      data-testid="hydra-status-badge"
      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-[helvetica-bold] uppercase tracking-wider ${
        available
          ? "border-cyan-400/30 bg-cyan-500/10 text-cyan-300"
          : "border-white/10 bg-white/5 text-secondary"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          available ? "bg-cyan-400 animate-pulse" : "bg-secondary/50"
        }`}
      />
      {available
        ? `Head Open — ${status?.headId?.slice(0, 12) ?? ""}`
        : "Hydra Offline"}
    </div>
  );
}

/* ─── Dashboard ─────────────────────────────────────────────────────────── */

function DashboardView({
  hydraStatus,
  metrics,
  recentIntents,
  wsEvents,
  eventsEndRef,
  onOpenIntent,
  onCreateNew,
}: {
  hydraStatus?: HydraStatus;
  metrics?: HydraMetrics;
  recentIntents?: PaymentIntent[];
  wsEvents: WsEvent[];
  eventsEndRef: React.RefObject<HTMLDivElement>;
  onOpenIntent: (i: PaymentIntent) => void;
  onCreateNew: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5"
    >
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="stats-row">
        <StatCard label="Total" value={metrics?.total_payments ?? 0} />
        <StatCard label="L2 Hydra" value={metrics?.l2_payments ?? 0} highlight />
        <StatCard
          label="Avg L2"
          value={
            metrics?.avg_l2_confirmation_ms
              ? `${metrics.avg_l2_confirmation_ms}ms`
              : "—"
          }
        />
        <StatCard label="Fallbacks" value={metrics?.l2_fallback_count ?? 0} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        {/* Hydra Head Panel */}
        <div
          className="lg:col-span-2 rounded-lg border-2 border-[#232323] bg-[#0d0d0d] p-4"
          data-testid="hydra-head-panel"
        >
          <h3 className="mb-3 text-[13px] font-[helvetica-bold] uppercase tracking-wider text-secondary">
            Hydra Head
          </h3>
          <div className="space-y-2.5 text-sm">
            <Row label="State" value={hydraStatus?.headState ?? "—"} />
            <Row
              label="Head ID"
              value={hydraStatus?.headId ?? "—"}
              mono
            />
            <Row label="Connection" value={hydraStatus?.connectionState ?? "—"} />
            <Row
              label="Available"
              value={hydraStatus?.available ? "Yes" : "No"}
              accent={hydraStatus?.available ? "cyan" : undefined}
            />
          </div>

          <h4 className="mb-1.5 mt-4 text-[11px] uppercase tracking-widest text-secondary/60">
            Live Events
          </h4>
          <div
            data-testid="ws-event-feed"
            className="h-32 overflow-y-auto rounded-md bg-black/60 p-2 font-mono text-[10px] leading-relaxed"
          >
            {wsEvents.length === 0 && (
              <span className="text-secondary/40">Waiting…</span>
            )}
            {wsEvents.map((ev, i) => (
              <div
                key={i}
                className={`flex gap-2 ${
                  ev.type === "PaymentIntentCreated"
                    ? "text-cyan-400"
                    : ev.type === "HeadOpen"
                      ? "text-white/60"
                      : "text-secondary/40"
                }`}
              >
                <span className="shrink-0 text-secondary/30">
                  {new Date(ev.timestamp).toLocaleTimeString()}
                </span>
                <span>{ev.type}</span>
                {ev.data && (
                  <span className="truncate text-secondary/30">{ev.data}</span>
                )}
              </div>
            ))}
            <div ref={eventsEndRef} />
          </div>
        </div>

        {/* Recent Intents */}
        <div
          className="lg:col-span-3 rounded-lg border-2 border-[#232323] bg-[#0d0d0d] p-4"
          data-testid="recent-intents"
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[13px] font-[helvetica-bold] uppercase tracking-wider text-secondary">
              Payment Intents
            </h3>
            <button
              data-testid="btn-new-payment"
              onClick={onCreateNew}
              className="flex items-center gap-1 rounded-md border border-[#232323] bg-[#181818] px-3 py-1.5 text-[11px] font-[helvetica-bold] uppercase tracking-wider text-white transition hover:border-white/20"
            >
              <FiPlus size={10} />
              New
            </button>
          </div>

          {(!recentIntents || recentIntents.length === 0) ? (
            <div className="flex flex-col items-center py-10 text-secondary/60">
              <p className="text-sm">No payment intents yet</p>
              <button
                onClick={onCreateNew}
                className="mt-2 text-xs text-cyan-400 underline"
              >
                Create your first intent
              </button>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
              {recentIntents
                .filter((i) => i.settlement_layer)
                .slice(0, 20)
                .map((intent) => (
                  <button
                    key={intent.tx_id}
                    data-testid={`intent-row-${intent.tx_id.slice(0, 8)}`}
                    onClick={() => onOpenIntent(intent)}
                    className="flex w-full items-center justify-between rounded-md bg-[#181818] px-3 py-2.5 text-left transition hover:bg-[#1f1f1f]"
                  >
                    <div className="flex items-center gap-3">
                      <LayerBadge layer={intent.settlement_layer} />
                      <div>
                        <span className="font-[offbit-dot-bold] text-sm">
                          {intent.amount} ADA
                        </span>
                        <span className="ml-2 font-mono text-[10px] text-secondary/50">
                          {intent.tx_id.slice(0, 8)}…
                        </span>
                      </div>
                    </div>
                    <IntentStatusPill intent={intent} />
                  </button>
                ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Create Intent ─────────────────────────────────────────────────────── */

function CreateIntentView({
  createAmount,
  setCreateAmount,
  createCurrency,
  setCreateCurrency,
  preferHydra,
  setPreferHydra,
  linkInvoice,
  setLinkInvoice,
  customerName,
  setCustomerName,
  customerEmail,
  setCustomerEmail,
  invoiceNotes,
  setInvoiceNotes,
  adaPrice,
  hydraAvailable,
  onSubmit,
  isSubmitting,
}: {
  createAmount: string;
  setCreateAmount: (v: string) => void;
  createCurrency: "ADA" | "VND";
  setCreateCurrency: (v: "ADA" | "VND") => void;
  preferHydra: boolean;
  setPreferHydra: (v: boolean) => void;
  linkInvoice: boolean;
  setLinkInvoice: (v: boolean) => void;
  customerName: string;
  setCustomerName: (v: string) => void;
  customerEmail: string;
  setCustomerEmail: (v: string) => void;
  invoiceNotes: string;
  setInvoiceNotes: (v: string) => void;
  adaPrice?: Record<string, number>;
  hydraAvailable: boolean;
  onSubmit: () => void;
  isSubmitting: boolean;
}) {
  const amountNum = parseFloat(createAmount) || 0;
  const adaEquiv =
    createCurrency === "VND" && adaPrice?.vnd
      ? (amountNum / adaPrice.vnd).toFixed(2)
      : amountNum.toFixed(2);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-[650px]"
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
        <div className="bg2 relative z-20 rounded-lg px-6 py-6" data-testid="create-intent-form">
          <div className="mb-6 flex items-center gap-3">
            <Image
              src="/logo.svg"
              alt="logo"
              width={1000}
              height={1000}
              className="w-[32px]"
            />
            <h2 className="font-[offbit-dot-bold] text-xl leading-6">
              Create Payment Intent
            </h2>
          </div>

          {/* Settlement Layer */}
          <label className="mb-2 block text-sm text-secondary">
            Settlement Layer
          </label>
          <div className="mb-5 flex gap-2" data-testid="layer-selector">
            <button
              data-testid="btn-layer-l2"
              onClick={() => setPreferHydra(true)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-[helvetica-bold] uppercase tracking-wide transition ${
                preferHydra
                  ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-300"
                  : "border-[#232323] bg-[#181818] text-secondary hover:text-white"
              }`}
            >
              ⚡ Hydra L2
              {hydraAvailable && preferHydra && (
                <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
              )}
            </button>
            <button
              data-testid="btn-layer-l1"
              onClick={() => setPreferHydra(false)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-[helvetica-bold] uppercase tracking-wide transition ${
                !preferHydra
                  ? "border-white/20 bg-white/10 text-white"
                  : "border-[#232323] bg-[#181818] text-secondary hover:text-white"
              }`}
            >
              L1 On-chain
            </button>
          </div>

          {/* Amount */}
          <label className="mb-2 block text-sm text-secondary">Amount</label>
          <div className="mb-2 flex gap-2">
            <div className="flex-1 rounded-lg bg-[#181818] px-4 py-2.5">
              <input
                data-testid="input-amount"
                type="number"
                step="0.01"
                min="0"
                value={createAmount}
                onChange={(e) => setCreateAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-transparent font-[offbit-dot-bold] text-2xl font-bold text-white outline-none placeholder:text-white/20"
              />
            </div>
            <div className="flex overflow-hidden rounded-lg border-2 border-[#232323]">
              {(["ADA", "VND"] as const).map((c) => (
                <button
                  key={c}
                  data-testid={`btn-currency-${c.toLowerCase()}`}
                  onClick={() => setCreateCurrency(c)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-bold transition ${
                    createCurrency === c
                      ? "bg-white/10 text-white"
                      : "text-secondary hover:text-white"
                  }`}
                >
                  <Image
                    src={c === "ADA" ? "/ADA.svg" : "/VND.svg"}
                    alt={c}
                    width={20}
                    height={20}
                    className="h-5 w-5 rounded-full"
                  />
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* ADA equiv */}
          <div className="mb-5 flex items-center justify-between rounded-lg border-2 border-[#232323] px-4 py-2.5">
            <span className="text-sm font-bold text-secondary">You get</span>
            <span className="font-[offbit-dot-bold] text-sm" data-testid="ada-conversion">
              {amountNum > 0 ? `${adaEquiv} ADA` : "—"}
            </span>
          </div>

          {/* Invoice toggle */}
          <div className="mb-4 flex items-center gap-3">
            <div
              data-testid="toggle-invoice"
              onClick={() => setLinkInvoice(!linkInvoice)}
              className={`relative h-5 w-9 cursor-pointer rounded-full transition ${
                linkInvoice ? "bg-cyan-500" : "bg-[#232323]"
              }`}
            >
              <div
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                  linkInvoice ? "translate-x-[18px]" : "translate-x-0.5"
                }`}
              />
            </div>
            <span className="text-sm text-secondary">
              Link invoice
            </span>
          </div>

          {/* Invoice details */}
          <AnimatePresence>
            {linkInvoice && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-5 space-y-3 overflow-hidden rounded-lg border-2 border-[#232323] bg-[#181818] p-4"
                data-testid="invoice-details"
              >
                <div className="grid grid-cols-2 gap-2">
                  <input
                    data-testid="input-customer-name"
                    type="text"
                    placeholder="Customer name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="rounded-lg bg-[#0d0d0d] px-3 py-2 text-sm text-white outline-none placeholder:text-secondary/40"
                  />
                  <input
                    data-testid="input-customer-email"
                    type="email"
                    placeholder="Customer email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="rounded-lg bg-[#0d0d0d] px-3 py-2 text-sm text-white outline-none placeholder:text-secondary/40"
                  />
                </div>
                <textarea
                  data-testid="input-notes"
                  placeholder="Notes…"
                  value={invoiceNotes}
                  onChange={(e) => setInvoiceNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg bg-[#0d0d0d] px-3 py-2 text-sm text-white outline-none placeholder:text-secondary/40 resize-none"
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Routing info */}
          <div
            className="mb-5 rounded-lg border-2 border-[#232323] px-4 py-3 text-xs text-secondary"
            data-testid="route-explanation"
          >
            {preferHydra
              ? "⚡ Routed via Hydra L2 — instant settlement (~380ms). Auto-fallback to L1 if head unavailable."
              : "Submitted to Cardano L1 — standard block confirmation (~20-40s)."}
          </div>

          {/* Submit */}
          <Button
            onClick={onSubmit}
            disabled={isSubmitting || !createAmount || amountNum <= 0}
            data-testid="btn-create-intent"
          >
            {isSubmitting ? (
              <span className="animate-pulse">Creating…</span>
            ) : (
              <>
                <MdDone size={22} />
                Initiate {adaEquiv} ADA via{" "}
                {preferHydra ? "Hydra L2" : "L1"}
              </>
            )}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Intent Detail ─────────────────────────────────────────────────────── */

function IntentDetailView({
  intent,
  onBack,
  onCopy,
}: {
  intent: PaymentIntent;
  onBack: () => void;
  onCopy: (text: string) => void;
}) {
  const { data: liveStatus } = useQuery<PaymentIntent>({
    queryKey: ["intentStatus", intent.tx_id],
    queryFn: async () =>
      (await axios.get(`/api/payment?tx=${intent.tx_id}`)).data,
    refetchInterval: intent.hydra_status === "confirmed" ? false : 1000,
    initialData: intent,
  });

  const confirmed =
    liveStatus?.status === 1 || liveStatus?.hydra_status === "confirmed";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-[650px]"
    >
      <button
        data-testid="btn-back"
        onClick={onBack}
        className="mb-3 text-sm text-secondary hover:text-white transition"
      >
        ← Back
      </button>

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
        <div className="bg2 relative z-20 rounded-lg px-6 py-6" data-testid="intent-detail">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="font-[offbit-dot-bold] text-2xl">
                {liveStatus?.amount ?? intent.amount} ADA
              </h2>
              <span className="text-sm text-secondary">Payment Intent</span>
            </div>
            <div className="flex items-center gap-2">
              <LayerBadge layer={intent.settlement_layer} />
              <IntentStatusPill intent={liveStatus ?? intent} />
            </div>
          </div>

          {/* Detail rows */}
          <div className="space-y-3 rounded-lg bg-[#181818] p-4">
            <DetailRow label="Transaction ID" mono>
              <span className="truncate">{intent.tx_id}</span>
              <button onClick={() => onCopy(intent.tx_id)} className="shrink-0">
                <MdContentCopy size={12} className="text-secondary hover:text-white" />
              </button>
            </DetailRow>
            <DetailRow label="Payment Address" mono>
              <span className="truncate max-w-[300px]">
                {intent.payment_address}
              </span>
              <button
                onClick={() => onCopy(intent.payment_address)}
                className="shrink-0"
              >
                <MdContentCopy size={12} className="text-secondary hover:text-white" />
              </button>
            </DetailRow>
            <DetailRow label="Created">
              {new Date(intent.created_at).toLocaleString()}
            </DetailRow>
            {intent.hydra_confirmed_at && (
              <DetailRow label="Confirmed">
                <span className="text-cyan-300">
                  {new Date(intent.hydra_confirmed_at).toLocaleString()}
                </span>
              </DetailRow>
            )}
          </div>

          {/* QR */}
          {!confirmed && (
            <div className="mt-6 flex flex-col items-center" data-testid="payment-qr">
              <span className="mb-3 text-xs text-secondary uppercase tracking-widest">
                Scan to Pay
              </span>
              <div className="rounded-xl bg-white p-3">
                <QRCode value={intent.payment_address} size={160} />
              </div>
            </div>
          )}

          {/* Confirmed */}
          {confirmed && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-6 flex items-center gap-3 rounded-lg border border-cyan-400/20 bg-cyan-500/5 px-4 py-3"
              data-testid="confirmed-banner"
            >
              <span className="text-2xl">✓</span>
              <div>
                <p className="font-[helvetica-bold] text-sm text-cyan-300">
                  Payment Confirmed
                </p>
                <p className="text-xs text-secondary">
                  {intent.settlement_layer === "L2"
                    ? "Settled instantly via Hydra L2"
                    : "Confirmed on Cardano L1"}
                </p>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Invoices ──────────────────────────────────────────────────────────── */

function InvoicesView({ invoices }: { invoices?: Invoice[] }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div
        className="rounded-lg border-2 border-[#232323] bg-[#0d0d0d] p-4"
        data-testid="invoices-list"
      >
        <h3 className="mb-3 text-[13px] font-[helvetica-bold] uppercase tracking-wider text-secondary">
          Invoices
        </h3>
        {(!invoices || invoices.length === 0) ? (
          <p className="py-8 text-center text-sm text-secondary/60">
            No invoices yet
          </p>
        ) : (
          <div className="space-y-1.5">
            {invoices.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between rounded-md bg-[#181818] px-3 py-2.5"
              >
                <div>
                  <span className="text-sm font-[helvetica-bold]">
                    {inv.number}
                  </span>
                  <span className="ml-2 text-xs text-secondary/50">
                    {inv.customer?.name ?? "—"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs">
                    {inv.asset.unit === "lovelace"
                      ? `${(parseInt(inv.asset.quantity) / 1_000_000).toFixed(2)} ADA`
                      : inv.asset.quantity}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      inv.status === "paid"
                        ? "bg-cyan-500/10 text-cyan-300"
                        : "bg-white/5 text-secondary"
                    }`}
                  >
                    {inv.status.replace("_", " ")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ─── Shared Components ─────────────────────────────────────────────────── */

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border-2 p-3 ${
        highlight
          ? "border-cyan-400/20 bg-cyan-500/5"
          : "border-[#232323] bg-[#0d0d0d]"
      }`}
    >
      <span className="text-[11px] uppercase tracking-widest text-secondary">
        {label}
      </span>
      <p
        className={`mt-1 font-[offbit-dot-bold] text-xl ${
          highlight ? "text-cyan-300" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-secondary">{label}</span>
      <span
        className={`${mono ? "font-mono text-xs" : ""} ${
          accent === "cyan" ? "text-cyan-300" : "text-white"
        } max-w-[160px] truncate`}
      >
        {value}
      </span>
    </div>
  );
}

function LayerBadge({ layer }: { layer: "L1" | "L2" }) {
  return layer === "L2" ? (
    <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-[helvetica-bold] text-cyan-300">
      L2 Hydra
    </span>
  ) : (
    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-[helvetica-bold] text-secondary">
      L1
    </span>
  );
}

function IntentStatusPill({ intent }: { intent: PaymentIntent }) {
  const confirmed =
    intent.status === 1 || intent.hydra_status === "confirmed";
  const failed = intent.hydra_status === "failed";

  if (confirmed)
    return (
      <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-cyan-300">
        Confirmed
      </span>
    );
  if (failed)
    return (
      <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-red-400">
        Failed
      </span>
    );
  return (
    <span className="flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase text-secondary">
      <span className="h-1.5 w-1.5 rounded-full bg-white/40 animate-pulse" />
      Pending
    </span>
  );
}

function DetailRow({
  label,
  children,
  mono,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="shrink-0 text-xs text-secondary">{label}</span>
      <div
        className={`flex items-center gap-1.5 text-sm text-white ${
          mono ? "font-mono text-xs" : ""
        }`}
      >
        {children}
      </div>
    </div>
  );
}
