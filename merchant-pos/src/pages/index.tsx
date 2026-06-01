import Head from "next/head";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import QRCode from "react-qr-code";

import Button from "~/components/Button";

type Snapshot = Record<string, { address: string; value: { lovelace: number } }>;
type ActiveResp = {
  head: { id: string; state: string; openedAt: string | null; contestationPeriodSeconds: number };
  hydra: { tag?: string } | null;
  snapshotUtxo: Snapshot | null;
};
type Intent = {
  id: string;
  tx_id: string;
  amount_lovelace: string;
  reference?: string;
  customer_name?: string;
  customer_email?: string;
  notes?: string;
  customer_id?: string;
  settlement_layer: "L2";
  status: "pending" | "paid" | "failed";
  hydra_tx_id?: string;
  created_at: string;
  paid_at?: string;
};
type Profile = {
  id: string;
  label: string | null;
  address: string;
  l1_lovelace: number;
  l2_lovelace: number;
};
type Stats = { total: number; l2: number; avg_l2_ms: number | null; fallbacks: number };
type Tab = "dashboard" | "create-intent" | "intent-detail" | "invoices" | "customers";
type WsEv = { at: number; tag: string; data?: string };

const MERCHANT_ADDR = "addr1v934t5jsnzp8ytxzmr8flh2yjy7xtal6rxf9ef9yvuw46ns5afxfu";
const CUSTOMER_ADDR = "addr1vxyfl6z5mclyuwvrgyc7733yhakjxlvs2ech2ssht4dhgzq8jy6wv";

function customerPayUrl(txId: string): string {
  if (typeof window === "undefined") return `/?tx=${txId}`;
  const fromEnv = process.env.NEXT_PUBLIC_CUSTOMER_BASE_URL;
  const base = fromEnv ?? window.location.origin;
  return `${base.replace(/\/$/, "")}/?tx=${txId}`;
}

export default function MerchantDashboard() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [active, setActive] = useState<ActiveResp | null>(null);
  const [activeErr, setActiveErr] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [intents, setIntents] = useState<Intent[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<Intent | null>(null);
  const [wsEvents, setWsEvents] = useState<WsEv[]>([]);
  const [tick, setTickAt] = useState(Date.now());

  useEffect(() => {
    const t = async () => {
      try {
        const r = await fetch("/api/heads/active");
        if (r.ok) setActive(await r.json());
        else setActiveErr(`HTTP ${r.status}`);
      } catch (e) {
        setActiveErr(e instanceof Error ? e.message : "fetch error");
      }
      try {
        const r = await fetch("/api/intents");
        if (r.ok) {
          const j = (await r.json()) as { intents: Intent[] };
          setIntents(j.intents);
        }
      } catch {}
      try {
        const r = await fetch("/api/intents/stats");
        if (r.ok) setStats(await r.json());
      } catch {}
      try {
        const r = await fetch("/api/customers");
        if (r.ok) {
          const j = (await r.json()) as { profiles: Profile[] };
          setProfiles(j.profiles);
        }
      } catch {}
      setTickAt(Date.now());
    };
    void t();
    const id = setInterval(t, 2500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!active?.head) return;
    const open = active.hydra?.tag === "Open";
    setWsEvents((prev) => {
      const last = prev[prev.length - 1];
      const tag = open ? "HeadOpen" : `Head${active.hydra?.tag ?? "Unknown"}`;
      if (last && last.tag === tag) return prev;
      return [
        ...prev.slice(-49),
        { at: Date.now(), tag, data: `Head ${active.head.id.slice(0, 12)} — ${active.hydra?.tag ?? "—"}` },
      ];
    });
  }, [active?.head?.id, active?.hydra?.tag]);

  useEffect(() => {
    if (active?.hydra?.tag !== "Open") return;
    const id = setInterval(() => {
      setWsEvents((prev) => [...prev.slice(-49), { at: Date.now(), tag: "Heartbeat", data: "WebSocket alive" }]);
    }, 8000);
    return () => clearInterval(id);
  }, [active?.hydra?.tag]);

  const headOpen = active?.hydra?.tag === "Open";
  const headIdShort = active?.head?.id?.slice(0, 12);

  const { merchantL2, customerL2 } = useMemo(() => {
    let m = 0, c = 0;
    for (const u of Object.values(active?.snapshotUtxo ?? {})) {
      const lov = Number(u.value?.lovelace ?? 0);
      if (u.address === MERCHANT_ADDR) m += lov;
      else if (u.address === CUSTOMER_ADDR) c += lov;
    }
    return { merchantL2: m, customerL2: c };
  }, [active]);

  return (
    <>
      <Head>
        <title>Merchant Dashboard — Hydra PoS</title>
      </Head>
      <main className="flex min-h-screen flex-col items-center bg-black px-[5%] py-8 text-white">
        {/* Header */}
        <div className="mb-6 flex w-[90vw] max-w-[900px] items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo.svg" alt="logo" width={48} height={48} className="h-9 w-9" priority />
            <h1 className="font-neue-regular text-2xl uppercase tracking-wide leading-6">
              Merchant Dashboard
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <HydraStatusPill open={headOpen} headIdShort={headIdShort} />
            <NewPaymentButton onClick={() => { setSelected(null); setTab("create-intent"); }} />
          </div>
        </div>

        {/* Nav tabs */}
        <nav className="mb-6 flex w-[90vw] max-w-[900px] gap-1 rounded-lg border border-[#232323] bg-[#0d0d0d] p-1">
          {(
            [
              ["dashboard", "Dashboard"],
              ["create-intent", "Create Intent"],
              ["customers", "Customers"],
              ["invoices", "Invoices"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={
                "rounded-md px-4 py-2 font-helvetica-medium text-sm transition " +
                (tab === id ? "bg-white/10 text-white" : "text-secondary hover:text-white")
              }
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="w-[90vw] max-w-[900px]">
          <AnimatePresence mode="wait">
            {tab === "dashboard" && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Dashboard
                  active={active}
                  stats={stats}
                  intents={intents}
                  wsEvents={wsEvents}
                  merchantL2={merchantL2}
                  customerL2={customerL2}
                  onOpenIntent={(i) => { setSelected(i); setTab("intent-detail"); }}
                  onCreateNew={() => { setSelected(null); setTab("create-intent"); }}
                />
              </motion.div>
            )}
            {tab === "create-intent" && (
              <motion.div
                key="create-intent"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <CreateIntent
                  headOpen={headOpen}
                  profiles={profiles}
                  onCreated={(i) => { setSelected(i); setTab("intent-detail"); }}
                />
              </motion.div>
            )}
            {tab === "intent-detail" && selected && (
              <motion.div
                key="intent-detail"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
              >
                <IntentDetail
                  intent={intents.find((x) => x.tx_id === selected.tx_id) ?? selected}
                  onBack={() => setTab("dashboard")}
                />
              </motion.div>
            )}
            {tab === "invoices" && (
              <motion.div
                key="invoices"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <InvoicesView intents={intents} />
              </motion.div>
            )}
            {tab === "customers" && (
              <motion.div
                key="customers"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <CustomersView profiles={profiles} intents={intents} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <footer className="mt-10 flex w-[90vw] max-w-[900px] items-center justify-between font-helvetica-light text-[10px] uppercase tracking-wider text-secondary/60">
          <p>cardano-node 11.0.1 · hydra-node 1.3.0 · mainnet · contestation 12h</p>
          <p>polled {new Date(tick).toLocaleTimeString()}</p>
        </footer>
        {activeErr && (
          <div className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 font-helvetica-medium text-sm text-red-200">
            {activeErr}
          </div>
        )}
      </main>
    </>
  );
}

/* Compact "+ New Payment" header button — different sizing than the main CTA */
function NewPaymentButton({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      initial={{ scale: 1 }}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 1 }}
      transition={{ duration: 0.3 }}
      className="group flex items-center gap-1.5 rounded-lg border border-black bg-white px-4 py-2 font-helvetica-bold text-xs uppercase tracking-wider text-black transition-all hover:tracking-widest"
    >
      + New Payment
    </motion.button>
  );
}

/* ─── Dashboard view ─────────────────────────────────────────────────────── */

function Dashboard({
  active, stats, intents, wsEvents, merchantL2, customerL2, onOpenIntent, onCreateNew,
}: {
  active: ActiveResp | null;
  stats: Stats | null;
  intents: Intent[];
  wsEvents: WsEv[];
  merchantL2: number;
  customerL2: number;
  onOpenIntent: (i: Intent) => void;
  onCreateNew: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total" value={stats?.total ?? 0} />
        <StatCard label="L2 Hydra" value={stats?.l2 ?? 0} highlight />
        <StatCard label="Avg L2" value={stats?.avg_l2_ms ? `${stats.avg_l2_ms} ms` : "—"} />
        <StatCard label="Fallbacks" value={stats?.fallbacks ?? 0} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <div className="rounded-lg border-2 border-[#232323] bg-[#0d0d0d] p-4 lg:col-span-2">
          <h3 className="mb-3 font-helvetica-bold text-[13px] uppercase tracking-wider text-secondary">
            Hydra Head
          </h3>
          <div className="space-y-2.5 text-sm">
            <Row label="State" value={active?.hydra?.tag ?? "—"} accent={active?.hydra?.tag === "Open" ? "cyan" : undefined} />
            <Row label="Head ID" value={active?.head?.id ?? "—"} mono />
            <Row label="Connection" value={active ? "connected" : "disconnected"} />
            <Row label="Available" value={active?.hydra?.tag === "Open" ? "Yes" : "No"} accent={active?.hydra?.tag === "Open" ? "cyan" : undefined} />
          </div>

          <h4 className="mb-1.5 mt-4 font-helvetica-light text-[11px] uppercase tracking-widest text-secondary/60">
            Live Events
          </h4>
          <div className="h-32 overflow-y-auto rounded-md bg-black/60 p-2 font-mono text-[10px] leading-relaxed">
            {wsEvents.length === 0 && <span className="text-secondary/40">Waiting…</span>}
            {wsEvents.map((ev, i) => (
              <div key={i} className={"flex gap-2 " + (ev.tag.startsWith("Head") ? "text-white/60" : ev.tag === "Heartbeat" ? "text-secondary/40" : "text-cyan-400")}>
                <span className="shrink-0 text-secondary/30">{new Date(ev.at).toLocaleTimeString()}</span>
                <span>{ev.tag}</span>
                {ev.data && <span className="truncate text-secondary/30">{ev.data}</span>}
              </div>
            ))}
          </div>

          <h4 className="mb-1.5 mt-4 font-helvetica-light text-[11px] uppercase tracking-widest text-secondary/60">
            In-head balance
          </h4>
          <div className="rounded-md bg-black/60 p-2 text-xs">
            <div className="font-helvetica-light text-[10px] uppercase tracking-widest text-secondary/60">Merchant</div>
            <div className="font-offbit-dot-bold text-lg leading-none text-cyan-300">₳ {(merchantL2 / 1e6).toFixed(2)}</div>
          </div>
        </div>

        <div className="rounded-lg border-2 border-[#232323] bg-[#0d0d0d] p-4 lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-helvetica-bold text-[13px] uppercase tracking-wider text-secondary">
              Payment Intents
            </h3>
            <motion.button
              onClick={onCreateNew}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 1 }}
              transition={{ duration: 0.3 }}
              className="group flex items-center gap-1 rounded-md border border-[#232323] bg-[#181818] px-3 py-1.5 font-helvetica-bold text-[11px] uppercase tracking-wider text-white transition-all hover:border-white/20 hover:tracking-widest"
            >
              + New
            </motion.button>
          </div>

          {intents.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-secondary/60">
              <p className="font-helvetica-medium text-sm">No payment intents yet</p>
              <button onClick={onCreateNew} className="mt-2 font-helvetica-medium text-xs text-cyan-400 underline">
                Create your first intent
              </button>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[340px] overflow-y-auto">
              {intents.map((i) => (
                <motion.button
                  key={i.tx_id}
                  onClick={() => onOpenIntent(i)}
                  whileHover={{ x: 4 }}
                  transition={{ duration: 0.2 }}
                  className="flex w-full items-center justify-between rounded-md bg-[#181818] px-3 py-2.5 text-left transition hover:bg-[#1f1f1f]"
                >
                  <div className="flex items-center gap-3">
                    <LayerBadge layer={i.settlement_layer} />
                    <div>
                      <span className="font-offbit-dot-bold text-base">
                        {(Number(i.amount_lovelace) / 1e6).toFixed(2)} ADA
                      </span>
                      <span className="ml-2 font-mono text-[10px] text-secondary/50">
                        {i.tx_id.slice(0, 8)}…
                      </span>
                    </div>
                  </div>
                  <IntentStatusPill status={i.status} />
                </motion.button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Create Intent view ─────────────────────────────────────────────────── */

function CreateIntent({ headOpen, profiles, onCreated }: { headOpen: boolean; profiles: Profile[]; onCreated: (i: Intent) => void }) {
  const [amount, setAmount] = useState("");
  const [preferHydra, setPreferHydra] = useState(true);
  const [linkInvoice, setLinkInvoice] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [customerId, setCustomerId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // Default-select the first profile when the list loads
  useEffect(() => {
    if (!customerId && profiles.length > 0) setCustomerId(profiles[0]!.id);
  }, [profiles, customerId]);

  const amountNum = parseFloat(amount) || 0;
  const canSubmit = headOpen && preferHydra && !submitting && amountNum > 0;

  const submit = useCallback(async () => {
    setSubmitting(true);
    try {
      const r = await fetch("/api/intents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amount_lovelace: String(Math.round(amountNum * 1_000_000)),
          customer_id: customerId || undefined,
          customer_name: linkInvoice && name ? name : undefined,
          customer_email: linkInvoice && email ? email : undefined,
          notes: linkInvoice && notes ? notes : undefined,
        }),
      });
      const j = (await r.json()) as { intent?: Intent; error?: string };
      if (r.ok && j.intent) onCreated(j.intent);
    } finally {
      setSubmitting(false);
    }
  }, [amountNum, customerId, linkInvoice, name, email, notes, onCreated]);

  return (
    <div className="mx-auto max-w-[650px]">
      <GradientCard>
        <div className="px-6 py-6">
          <div className="mb-6 flex items-center gap-3">
            <Image src="/logo.svg" alt="logo" width={48} height={48} className="h-8 w-8" />
            <h2 className="font-neue-regular text-2xl uppercase tracking-wide leading-6">
              Create Payment Intent
            </h2>
          </div>

          <label className="mb-2 block font-helvetica-medium text-sm uppercase tracking-wider text-secondary">
            Target Customer
          </label>
          {profiles.length === 0 ? (
            <div className="mb-5 rounded-lg border-2 border-amber-500/30 bg-amber-500/5 px-4 py-3 font-helvetica-medium text-xs text-amber-200/80">
              No customer profiles registered yet. Send a customer to the Customer site to create one first, or skip — the intent will fall back to the head's default customer key.
            </div>
          ) : (
            <div className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {profiles.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setCustomerId(p.id)}
                  className={
                    "group flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left font-helvetica-medium transition-all duration-300 " +
                    (p.id === customerId
                      ? "border-accent-blue-400/40 bg-accent-blue-500/10 text-accent-blue-200"
                      : "border-[#232323] bg-[#181818] text-secondary hover:text-white")
                  }
                >
                  <div className="min-w-0">
                    <p className="truncate font-helvetica-bold text-sm">
                      {p.label ?? `Profile ${p.id.slice(0, 6)}`}
                    </p>
                    <p className="truncate font-mono text-[10px] text-secondary/60">{p.address.slice(0, 26)}…</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-offbit-dot-bold text-xs leading-none">L2 ₳ {(p.l2_lovelace / 1e6).toFixed(2)}</p>
                    <p className="font-helvetica-light text-[10px] text-secondary/60">L1 ₳ {(p.l1_lovelace / 1e6).toFixed(2)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          <label className="mb-2 block font-helvetica-medium text-sm uppercase tracking-wider text-secondary">
            Settlement Layer
          </label>
          <div className="mb-5 flex gap-2">
            <button
              onClick={() => setPreferHydra(true)}
              className={
                "group flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-3 font-helvetica-bold text-sm uppercase tracking-wider transition-all duration-300 hover:tracking-widest " +
                (preferHydra
                  ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-300"
                  : "border-[#232323] bg-[#181818] text-secondary hover:text-white")
              }
            >
              ⚡ Hydra L2
              {headOpen && preferHydra && <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />}
            </button>
            <button
              disabled
              className="flex flex-1 cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-[#232323] bg-[#181818] px-4 py-3 font-helvetica-bold text-sm uppercase tracking-wider text-secondary/50"
              title="L1 fallback disabled in this build"
            >
              L1 On-chain
            </button>
          </div>

          <label className="mb-2 block font-helvetica-medium text-sm uppercase tracking-wider text-secondary">
            Amount
          </label>
          <div className="mb-2 flex gap-2">
            <div className="flex-1 rounded-lg bg-[#181818] px-4 py-2.5">
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-transparent font-offbit-dot-bold text-3xl text-white outline-none placeholder:text-white/20"
              />
            </div>
            <div className="flex overflow-hidden rounded-lg border-2 border-[#232323]">
              <div className="flex items-center gap-1.5 bg-white/10 px-3 py-2 font-helvetica-bold text-sm text-white">
                <Image src="/ADA.svg" alt="ADA" width={20} height={20} className="h-5 w-5 rounded-full" />
                ADA
              </div>
            </div>
          </div>
          <div className="mb-5 flex items-center justify-between rounded-lg border-2 border-[#232323] px-4 py-2.5">
            <span className="font-helvetica-bold text-sm uppercase tracking-wider text-secondary">You get</span>
            <span className="font-offbit-dot-bold text-base">
              {amountNum > 0 ? `${amountNum.toFixed(2)} ADA` : "—"}
            </span>
          </div>

          <div className="mb-4 flex items-center gap-3">
            <button
              onClick={() => setLinkInvoice(!linkInvoice)}
              className={"relative h-5 w-9 rounded-full transition " + (linkInvoice ? "bg-cyan-500" : "bg-[#232323]")}
            >
              <div className={"absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform " + (linkInvoice ? "translate-x-[18px]" : "translate-x-0.5")} />
            </button>
            <span className="font-helvetica-medium text-sm text-secondary">Link invoice</span>
          </div>

          <AnimatePresence>
            {linkInvoice && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-5 space-y-3 overflow-hidden rounded-lg border-2 border-[#232323] bg-[#181818] p-4"
              >
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Customer name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="rounded-lg bg-[#0d0d0d] px-3 py-2 font-helvetica-medium text-sm text-white outline-none placeholder:text-secondary/60"
                  />
                  <input
                    type="email"
                    placeholder="Customer email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="rounded-lg bg-[#0d0d0d] px-3 py-2 font-helvetica-medium text-sm text-white outline-none placeholder:text-secondary/60"
                  />
                </div>
                <textarea
                  placeholder="Notes…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full resize-none rounded-lg bg-[#0d0d0d] px-3 py-2 font-helvetica-medium text-sm text-white outline-none placeholder:text-secondary/60"
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mb-5 rounded-lg border-2 border-[#232323] px-4 py-3 font-helvetica-medium text-xs text-secondary">
            ⚡ Routed via Hydra L2 — instant settlement (~380ms). Auto-fallback to L1 if head unavailable.
          </div>

          <Button onClick={() => void submit()} disabled={!canSubmit} loading={submitting}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Initiate {amountNum > 0 ? amountNum.toFixed(2) : "0.00"} ADA via Hydra L2
          </Button>
        </div>
      </GradientCard>
    </div>
  );
}

/* ─── Intent Detail (with QR) ────────────────────────────────────────────── */

function IntentDetail({ intent, onBack }: { intent: Intent; onBack: () => void }) {
  const amount = Number(intent.amount_lovelace) / 1e6;
  const payUrl = customerPayUrl(intent.tx_id);
  const isPaid = intent.status === "paid";

  return (
    <div className="mx-auto max-w-[650px]">
      <button onClick={onBack} className="mb-3 font-helvetica-medium text-sm text-secondary transition hover:text-white">
        ← Back
      </button>
      <GradientCard>
        <div className="px-6 py-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="font-offbit-dot-bold text-4xl leading-none">{amount.toFixed(2)} ADA</h2>
              <span className="mt-1 block font-helvetica-medium text-sm uppercase tracking-wider text-secondary">Payment Intent</span>
            </div>
            <div className="flex items-center gap-2">
              <LayerBadge layer="L2" />
              <IntentStatusPill status={intent.status} />
            </div>
          </div>

          <div className="space-y-3 rounded-lg bg-[#181818] p-4">
            <DetailRow label="Intent ID"><span className="font-mono text-xs">{intent.id}</span></DetailRow>
            <DetailRow label="Transaction ID"><span className="font-mono text-xs">{intent.tx_id}</span></DetailRow>
            <DetailRow label="Payment URL">
              <span className="max-w-[360px] truncate font-mono text-[10px] text-secondary">{payUrl}</span>
              <button onClick={() => navigator.clipboard.writeText(payUrl)} className="font-helvetica-bold text-xs uppercase tracking-wider text-cyan-400 hover:text-cyan-300">
                copy
              </button>
            </DetailRow>
            <DetailRow label="Created">
              <span className="font-helvetica-medium text-xs">{new Date(intent.created_at).toLocaleString()}</span>
            </DetailRow>
            {intent.hydra_tx_id && (
              <DetailRow label="Hydra L2 Tx">
                <span className="font-mono text-xs text-cyan-300">{intent.hydra_tx_id.slice(0, 18)}…</span>
              </DetailRow>
            )}
            {intent.paid_at && (
              <DetailRow label="Confirmed">
                <span className="font-helvetica-medium text-xs text-cyan-300">{new Date(intent.paid_at).toLocaleString()}</span>
              </DetailRow>
            )}
          </div>

          {!isPaid ? (
            <div className="mt-6 flex flex-col items-center">
              <span className="mb-3 font-helvetica-bold text-xs uppercase tracking-widest text-secondary">Scan to Pay</span>
              <div className="rounded-xl border-2 border-cyan-400/40 bg-white p-3">
                <QRCode value={payUrl} size={180} />
              </div>
              <span className="mt-3 max-w-sm text-center font-helvetica-light text-[10px] uppercase tracking-wider text-secondary/60">
                Customer opens this URL or scans the QR — it leads to the customer payment page.
              </span>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-6 flex items-center gap-3 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-4 py-4"
            >
              <span className="text-3xl">✓</span>
              <div>
                <p className="font-helvetica-bold text-sm uppercase tracking-wider text-cyan-300">Payment Confirmed</p>
                <p className="font-helvetica-medium text-xs text-secondary">Settled instantly via Hydra L2</p>
              </div>
            </motion.div>
          )}
        </div>
      </GradientCard>
    </div>
  );
}

/* ─── Invoices view ──────────────────────────────────────────────────────── */

function InvoicesView({ intents }: { intents: Intent[] }) {
  return (
    <div className="rounded-lg border-2 border-[#232323] bg-[#0d0d0d] p-4">
      <h3 className="mb-3 font-helvetica-bold text-[13px] uppercase tracking-wider text-secondary">Invoices</h3>
      {intents.filter((i) => i.customer_name || i.customer_email).length === 0 ? (
        <p className="py-8 text-center font-helvetica-medium text-sm text-secondary/60">
          No invoiced payments yet — create an intent with the “Link invoice” toggle on.
        </p>
      ) : (
        <div className="space-y-1.5">
          {intents
            .filter((i) => i.customer_name || i.customer_email)
            .map((i) => (
              <div key={i.tx_id} className="flex items-center justify-between rounded-md bg-[#181818] px-3 py-2.5">
                <div>
                  <span className="font-helvetica-bold text-sm">{i.id}</span>
                  <span className="ml-2 font-helvetica-medium text-xs text-secondary/50">
                    {i.customer_name ?? "—"} {i.customer_email ? `· ${i.customer_email}` : ""}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-offbit-dot-bold text-base">
                    {(Number(i.amount_lovelace) / 1e6).toFixed(2)} ADA
                  </span>
                  <IntentStatusPill status={i.status} />
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

/* ─── Shared components ──────────────────────────────────────────────────── */

function HydraStatusPill({ open, headIdShort }: { open: boolean; headIdShort?: string }) {
  return (
    <div
      className={
        "flex items-center gap-2 rounded-full border px-3 py-1.5 font-helvetica-bold text-[11px] uppercase tracking-wider " +
        (open
          ? "border-cyan-400/30 bg-cyan-500/10 text-cyan-300"
          : "border-white/10 bg-white/5 text-secondary")
      }
    >
      <span className={"h-2 w-2 rounded-full " + (open ? "bg-cyan-400 animate-pulse" : "bg-secondary/50")} />
      {open ? `Head Open — ${headIdShort ?? ""}` : "Hydra Initialising"}
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div
      className={
        "rounded-lg border-2 p-3 " +
        (highlight ? "border-cyan-400/20 bg-cyan-500/5" : "border-[#232323] bg-[#0d0d0d]")
      }
    >
      <span className="font-helvetica-light text-[11px] uppercase tracking-widest text-secondary">{label}</span>
      <p className={"mt-1 font-offbit-dot-bold text-2xl leading-none " + (highlight ? "text-cyan-300" : "")}>{value}</p>
    </div>
  );
}

function Row({ label, value, mono, accent }: { label: string; value: string; mono?: boolean; accent?: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="font-helvetica-medium text-secondary">{label}</span>
      <span
        className={
          (mono ? "font-mono text-xs " : "font-helvetica-medium ") +
          (accent === "cyan" ? "text-cyan-300 " : "text-white ") +
          "max-w-[220px] truncate"
        }
      >
        {value}
      </span>
    </div>
  );
}

function LayerBadge({ layer }: { layer: string }) {
  return (
    <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 font-thunder-semibold text-[11px] uppercase tracking-wider text-cyan-300">
      {layer === "L2" ? "L2 Hydra" : layer}
    </span>
  );
}

function IntentStatusPill({ status }: { status: Intent["status"] }) {
  if (status === "paid")
    return (
      <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 font-helvetica-bold text-[10px] uppercase tracking-wider text-cyan-300">
        Confirmed
      </span>
    );
  if (status === "failed")
    return (
      <span className="rounded-full bg-red-500/10 px-2 py-0.5 font-helvetica-bold text-[10px] uppercase tracking-wider text-red-400">
        Failed
      </span>
    );
  return (
    <span className="flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 font-helvetica-bold text-[10px] uppercase tracking-wider text-secondary">
      <span className="h-1.5 w-1.5 rounded-full bg-white/40 animate-pulse" />
      Pending
    </span>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="shrink-0 font-helvetica-light text-xs uppercase tracking-wider text-secondary">{label}</span>
      <div className="flex items-center gap-1.5 text-sm text-white">{children}</div>
    </div>
  );
}

function GradientCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="card-shell">
      <div className="card-bg2" />
      <div className="card-fade" />
      <div className="card-inner">{children}</div>
    </div>
  );
}

/* ─── Customers view (registered profiles + per-profile stats) ───────────── */

function CustomersView({ profiles, intents }: { profiles: Profile[]; intents: Intent[] }) {
  const intentsByProfile = useMemo(() => {
    const m = new Map<string, Intent[]>();
    for (const i of intents) {
      if (!i.customer_id) continue;
      const arr = m.get(i.customer_id) ?? [];
      arr.push(i);
      m.set(i.customer_id, arr);
    }
    return m;
  }, [intents]);

  return (
    <div className="rounded-lg border-2 border-[#232323] bg-[#0d0d0d] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-helvetica-bold text-[13px] uppercase tracking-wider text-secondary">
          Registered customers
        </h3>
        <span className="font-helvetica-light text-[11px] uppercase tracking-widest text-secondary/60">
          {profiles.length} profile{profiles.length === 1 ? "" : "s"}
        </span>
      </div>
      {profiles.length === 0 ? (
        <div className="py-10 text-center">
          <p className="font-helvetica-medium text-sm text-secondary/60">No customers yet.</p>
          <p className="mt-1 font-helvetica-light text-[11px] uppercase tracking-wider text-secondary/40">
            Share the customer URL — they create a profile, fund it with Vespr, commit to the head.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {profiles.map((p) => {
            const profileIntents = intentsByProfile.get(p.id) ?? [];
            const paid = profileIntents.filter((i) => i.status === "paid").length;
            const pending = profileIntents.filter((i) => i.status === "pending").length;
            return (
              <div key={p.id} className="rounded-md bg-[#181818] px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-helvetica-bold text-sm">
                        {p.label ?? `Profile ${p.id.slice(0, 6)}`}
                      </span>
                      <span className="rounded-full bg-white/5 px-2 py-0.5 font-helvetica-bold text-[9px] uppercase tracking-wider text-secondary">
                        {p.id.slice(0, 8)}…
                      </span>
                    </div>
                    <p className="truncate font-mono text-[10px] text-secondary/50">{p.address}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-offbit-dot-bold text-base leading-none">
                      L2 ₳ {(p.l2_lovelace / 1e6).toFixed(2)}
                    </p>
                    <p className="font-helvetica-light text-[10px] text-secondary/60">
                      L1 ₳ {(p.l1_lovelace / 1e6).toFixed(2)}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2 font-helvetica-light text-[10px] uppercase tracking-wider text-secondary/60">
                  <span>intents:</span>
                  <span className="rounded bg-accent-blue-500/10 px-1.5 py-0.5 text-accent-blue-300">{paid} paid</span>
                  <span className="rounded bg-white/5 px-1.5 py-0.5 text-secondary">{pending} pending</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
