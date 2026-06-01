import Head from "next/head";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";

import Button from "~/components/Button";
import type { WalletState } from "~/components/WalletBridge";
import type { BrowserWallet } from "@meshsdk/core"; // type-only, erased at build

// All Mesh runtime modules live under client-only dynamic loads so Next's
// server build doesn't pull in their WASM.
const CardanoWallet = dynamic(
  () => import("@meshsdk/react").then((m) => m.CardanoWallet),
  { ssr: false },
);
const WalletBridge = dynamic(() => import("~/components/WalletBridge"), { ssr: false });
const CustomerApp = dynamic(() => Promise.resolve(CustomerInner), { ssr: false });

export default function CustomerPage() {
  return <CustomerApp />;
}

type Profile = {
  id: string;
  label: string | null;
  /** Server-controlled L1 enterprise address (the head deposit address). */
  address: string;
  /** The user's connected wallet base address (Vespr/Eternl/Lace). */
  walletAddress: string | null;
  ownerAddress: string | null;
};
type ProfileFull = Profile & {
  l1_lovelace: number;
  l1_utxos: { ref: string; lovelace: number }[];
  l2_lovelace: number;
  l2_utxo_count: number;
};
type Intent = {
  id: string;
  tx_id: string;
  amount_lovelace: string;
  reference?: string;
  customer_id?: string;
  settlement_layer: "L2";
  status: "pending" | "paid" | "failed";
  hydra_tx_id?: string;
  created_at: string;
  paid_at?: string;
};
type ActiveHead = {
  head: { id: string; state: string; openedAt: string | null };
  hydra: { tag?: string } | null;
};

/** Stages of the hybrid commit flow shown to the user as a vertical stepper. */
const COMMIT_STEPS: { key: string; label: string; estimateSec: number }[] = [
  { key: "sign", label: "Sign L1 send in your wallet", estimateSec: 20 },
  { key: "l1send", label: "L1 send lands at deposit address", estimateSec: 45 },
  { key: "commitTx", label: "Server signs + submits Hydra commit", estimateSec: 5 },
  { key: "l1commit", label: "Commit tx confirms on L1", estimateSec: 45 },
  { key: "activate", label: "Hydra deposit-period activation", estimateSec: 300 },
  { key: "snapshot", label: "Snapshot incorporates the deposit", estimateSec: 30 },
];
const COMMIT_TOTAL_ETA_SEC = COMMIT_STEPS.reduce((a, s) => a + s.estimateSec, 0);

function CustomerInner() {
  const [meshState, setMeshState] = useState<WalletState>({
    wallet: null,
    connected: false,
    name: null,
  });
  const wallet = meshState.wallet as BrowserWallet | null;
  const connected = meshState.connected;
  const walletName = meshState.name;

  const router = useRouter();
  const { tx } = router.query;
  const txId = typeof tx === "string" ? tx : null;

  const [walletAddr, setWalletAddr] = useState<string | null>(null);
  const [walletStake, setWalletStake] = useState<string | null>(null);
  const [walletL1, setWalletL1] = useState<number>(0);
  /** UTxOs the wallet actually controls (across ALL its addresses), via Mesh
   *  getUtxos. This is the source of truth for the Split decision and commit
   *  UTxO picking. The server's Blockfrost-by-address lookup is now only used
   *  for display + L2 snapshot filtering. */
  const [walletUtxos, setWalletUtxos] = useState<
    { ref: string; addr: string; lovelace: number }[]
  >([]);
  const [profile, setProfile] = useState<ProfileFull | null>(null);
  const [profileBootstrapping, setProfileBootstrapping] = useState(false);
  const [needsUsername, setNeedsUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);
  const [intents, setIntents] = useState<Intent[]>([]);
  const [head, setHead] = useState<ActiveHead | null>(null);
  const [commitAmount, setCommitAmount] = useState("10");
  const [committing, setCommitting] = useState(false);
  /** Multi-stage commit progress. null = idle; otherwise active step index +
   *  per-step elapsed timestamps so the stepper can show countdowns. */
  const [commitProgress, setCommitProgress] = useState<{
    active: number;
    totalStartedAt: number;
    stepStartedAt: number;
    failedAt?: number;
    failReason?: string;
  } | null>(null);
  const [paying, setPaying] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  // Refresh wallet UTxOs via Mesh — call after connect, and after any send.
  const refreshWalletUtxos = useCallback(async () => {
    if (!wallet) return;
    try {
      type MeshUtxo = {
        input: { txHash: string; outputIndex: number };
        output: { address: string; amount: { unit: string; quantity: string }[] };
      };
      const utxos = ((await wallet.getUtxos()) ?? []) as MeshUtxo[];
      const parsed = utxos.map((u) => ({
        ref: `${u.input.txHash}#${u.input.outputIndex}`,
        addr: u.output.address,
        lovelace: Number(u.output.amount.find((a) => a.unit === "lovelace")?.quantity ?? "0"),
      }));
      setWalletUtxos(parsed);
    } catch (e) {
      // ignore — keep last known
    }
  }, [wallet]);

  // Resolve wallet addresses + UTxOs when connected
  useEffect(() => {
    if (!connected || !wallet) {
      setWalletAddr(null);
      setWalletStake(null);
      setWalletL1(0);
      setWalletUtxos([]);
      setProfile(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const used = await wallet.getUsedAddresses();
        if (!cancelled && used.length > 0) setWalletAddr(used[0] ?? null);
      } catch (e) {
        if (!cancelled) setErrMsg(e instanceof Error ? e.message : "wallet read failed");
      }
      try {
        const stakes = await wallet.getRewardAddresses();
        if (!cancelled && stakes.length > 0) setWalletStake(stakes[0] ?? null);
      } catch {}
      try {
        const lov = await wallet.getLovelace();
        if (!cancelled) setWalletL1(Number(lov));
      } catch {}
      await refreshWalletUtxos();
    })();
    return () => {
      cancelled = true;
    };
  }, [connected, wallet, refreshWalletUtxos]);

  // Look up existing profile on connect — if none, prompt for a username
  // BEFORE creating the profile.
  useEffect(() => {
    if (!walletAddr) return;
    let cancelled = false;
    void (async () => {
      setProfileBootstrapping(true);
      try {
        const owner = walletStake ?? walletAddr;
        const r = await fetch(`/api/customers/by-wallet?owner=${encodeURIComponent(owner)}`);
        if (r.ok) {
          const j = (await r.json()) as { profile: Profile };
          const r2 = await fetch(`/api/customers/${j.profile.id}`);
          if (r2.ok) {
            const full = (await r2.json()) as ProfileFull;
            if (!cancelled)
              setProfile({
                ...j.profile,
                l1_lovelace: full.l1_lovelace,
                l1_utxos: full.l1_utxos,
                l2_lovelace: full.l2_lovelace,
                l2_utxo_count: full.l2_utxo_count,
              });
          } else if (!cancelled) {
            setProfile({
              ...j.profile,
              l1_lovelace: 0,
              l1_utxos: [],
              l2_lovelace: 0,
              l2_utxo_count: 0,
            });
          }
        } else if (r.status === 404) {
          // No profile yet — show the username prompt.
          if (!cancelled) {
            setNeedsUsername(true);
            setUsernameInput("");
          }
        } else {
          const j = (await r.json().catch(() => ({}))) as { error?: string };
          if (!cancelled) setErrMsg(j.error ?? "profile lookup failed");
        }
      } catch (e) {
        if (!cancelled) setErrMsg(e instanceof Error ? e.message : "network error");
      } finally {
        if (!cancelled) setProfileBootstrapping(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [walletAddr, walletStake]);

  const submitUsername = useCallback(async () => {
    if (!walletAddr) return;
    const username = usernameInput.trim();
    if (username.length < 2 || username.length > 30) {
      setErrMsg("username must be 2-30 characters");
      return;
    }
    setSavingUsername(true);
    setErrMsg(null);
    try {
      const r = await fetch("/api/customers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          owner_address: walletStake ?? walletAddr,
          wallet_address: walletAddr,
          label: username,
        }),
      });
      const j = (await r.json()) as { profile?: Profile; error?: string };
      if (!r.ok || !j.profile) {
        setErrMsg(j.error ?? "registration failed");
        return;
      }
      const r2 = await fetch(`/api/customers/${j.profile.id}`);
      if (r2.ok) {
        const full = (await r2.json()) as ProfileFull;
        setProfile({
          ...j.profile,
          l1_lovelace: full.l1_lovelace,
          l1_utxos: full.l1_utxos,
          l2_lovelace: full.l2_lovelace,
          l2_utxo_count: full.l2_utxo_count,
        });
      } else {
        setProfile({
          ...j.profile,
          l1_lovelace: 0,
          l1_utxos: [],
          l2_lovelace: 0,
          l2_utxo_count: 0,
        });
      }
      setNeedsUsername(false);
      setToast(`Welcome, ${username}!`);
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : "network error");
    } finally {
      setSavingUsername(false);
    }
  }, [walletAddr, walletStake, usernameInput]);

  // Poll head status independently (no wallet/profile needed) so the status
  // pill is correct from page load.
  useEffect(() => {
    let cancelled = false;
    const t = async () => {
      try {
        const r = await fetch("/api/heads/active");
        if (r.ok && !cancelled) setHead((await r.json()) as ActiveHead);
      } catch {}
    };
    void t();
    const id = setInterval(t, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Poll profile + intents + wallet L1 (only meaningful once a profile exists)
  useEffect(() => {
    const pid = profile?.id;
    if (!pid) return;
    let cancelled = false;
    const t = async () => {
      try {
        const r = await fetch(`/api/customers/${pid}`);
        if (r.ok) {
          const full = (await r.json()) as ProfileFull;
          if (!cancelled) {
            setProfile((p) =>
              p
                ? {
                    ...p,
                    l1_lovelace: full.l1_lovelace,
                    l1_utxos: full.l1_utxos,
                    l2_lovelace: full.l2_lovelace,
                    l2_utxo_count: full.l2_utxo_count,
                  }
                : p,
            );
          }
        }
      } catch {}
      try {
        const r = await fetch("/api/intents");
        if (r.ok) {
          const j = (await r.json()) as { intents: Intent[] };
          if (!cancelled) setIntents(j.intents);
        }
      } catch {}
      if (wallet) {
        try {
          const lov = await wallet.getLovelace();
          if (!cancelled) setWalletL1(Number(lov));
        } catch {}
        // refresh UTxO list too so the Split / Commit gates update post-tx
        await refreshWalletUtxos();
      }
    };
    void t();
    const id = setInterval(t, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [profile?.id, wallet, refreshWalletUtxos]);

  const myIntents = useMemo(
    () => intents.filter((i) => i.customer_id === profile?.id),
    [intents, profile?.id],
  );
  const deepIntent = useMemo(() => {
    if (!txId) return null;
    return intents.find((i) => i.tx_id === txId) ?? null;
  }, [txId, intents]);

  /* ─── Commit (hybrid: wallet sends L1 -> deposit addr, server signs commit) ── */
  const onCommit = useCallback(async () => {
    if (!wallet || !profile || !head?.head?.id) return;
    const ada = parseFloat(commitAmount);
    if (!Number.isFinite(ada) || ada < 2) {
      setErrMsg("commit amount must be ≥ 2 ADA");
      return;
    }
    const target = BigInt(Math.round(ada * 1_000_000));
    const initialL2 = profile.l2_lovelace;

    const tStart = Date.now();
    setCommitting(true);
    setErrMsg(null);
    setCommitProgress({ active: 0, totalStartedAt: tStart, stepStartedAt: tStart });
    const advance = (toIdx: number) =>
      setCommitProgress((p) =>
        p ? { ...p, active: toIdx, stepStartedAt: Date.now() } : p,
      );
    const fail = (reason: string) =>
      setCommitProgress((p) =>
        p ? { ...p, failedAt: Date.now(), failReason: reason } : p,
      );

    try {
      // Step 0: Vespr signs the L1 send wallet -> profile.address
      const { Transaction, BlockfrostProvider } = await import("@meshsdk/core");
      const projectId = process.env.NEXT_PUBLIC_BLOCKFROST_PROJECT_ID;
      if (!projectId) throw new Error("NEXT_PUBLIC_BLOCKFROST_PROJECT_ID missing");
      const provider = new BlockfrostProvider(projectId);
      const tx = new Transaction({ initiator: wallet, fetcher: provider, submitter: provider })
        .setNetwork("mainnet")
        .sendLovelace(profile.address, target.toString());
      const unsigned = await tx.build();
      const signed = await wallet.signTx(unsigned);
      const l1SendHash = await wallet.submitTx(signed);
      setToast(`Vespr signed L1 tx ${l1SendHash.slice(0, 14)}…`);

      // Step 1: poll Blockfrost (via our API) for the deposit UTxO appearing
      advance(1);
      let depositUtxoSeen = false;
      for (let i = 0; i < 90; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        try {
          const r = await fetch(`/api/customers/${profile.id}`);
          if (!r.ok) continue;
          const j = (await r.json()) as ProfileFull;
          if (j.l1_utxos.some((u) => BigInt(u.lovelace) >= target - 200_000n)) {
            depositUtxoSeen = true;
            break;
          }
        } catch {}
      }
      if (!depositUtxoSeen) {
        fail("L1 send not confirmed after 7.5 min");
        return;
      }

      // Step 2: server signs + submits the Hydra /commit (returns immediately)
      advance(2);
      const r2 = await fetch(`/api/heads/${head.head.id}/commit-deposit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          profile_id: profile.id,
          amount_lovelace: target.toString(),
        }),
      });
      const j2 = (await r2.json()) as { l1TxId?: string; error?: string };
      if (!r2.ok || !j2.l1TxId) {
        fail(j2.error ?? "commit-deposit failed");
        return;
      }

      // Step 3: the commit tx spends the deposit-addr UTxO; poll until it's gone
      advance(3);
      let commitConfirmed = false;
      for (let i = 0; i < 36; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        try {
          const r = await fetch(`/api/customers/${profile.id}`);
          if (!r.ok) continue;
          const j = (await r.json()) as ProfileFull;
          if (!j.l1_utxos.some((u) => BigInt(u.lovelace) >= target - 200_000n)) {
            commitConfirmed = true;
            break;
          }
        } catch {}
      }
      if (!commitConfirmed) {
        fail("commit tx not confirmed on L1 after 3 min");
        return;
      }

      // Step 4: deposit-period activation window (5 min on this head)
      advance(4);
      // Step 5: incorporation into the L2 snapshot — poll l2_lovelace
      // We just keep polling — the UI advances visually based on elapsed time.
      const polledForActivation = Date.now();
      let incorporated = false;
      for (let i = 0; i < 96; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        // Auto-advance to step 5 once activation eta elapsed (visual hint).
        if (Date.now() - polledForActivation > COMMIT_STEPS[4]!.estimateSec * 1000) {
          setCommitProgress((p) =>
            p && p.active === 4 ? { ...p, active: 5, stepStartedAt: Date.now() } : p,
          );
        }
        try {
          const r = await fetch(`/api/customers/${profile.id}`);
          if (!r.ok) continue;
          const j = (await r.json()) as ProfileFull;
          if (j.l2_lovelace >= initialL2 + Number(target) - 300_000) {
            incorporated = true;
            break;
          }
        } catch {}
      }
      if (!incorporated) {
        fail("snapshot didn't include the deposit within 8 min — try again");
        return;
      }

      setCommitProgress(null);
      setToast(
        `${ada.toFixed(2)} ADA is now live in-head 🎉 (took ${Math.round((Date.now() - tStart) / 1000)}s)`,
      );
    } catch (e) {
      fail(e instanceof Error ? e.message : "commit failed");
      setErrMsg(e instanceof Error ? e.message : "commit failed");
    } finally {
      setCommitting(false);
    }
  }, [wallet, profile, commitAmount, head?.head?.id]);

  /* ─── Pay an intent (server signs in-head tx with profile's L2 spend key) ── */
  const onPay = useCallback(
    async (intent: Intent) => {
      if (!profile || !head?.head?.id) return;
      setPaying(intent.tx_id);
      try {
        const r = await fetch(`/api/intents/${intent.tx_id}/pay`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ profile_id: profile.id }),
        });
        const j = (await r.json()) as {
          intent?: Intent;
          transactionId?: string;
          error?: string;
        };
        if (r.ok && j.intent) {
          setToast(
            `Paid ${(Number(intent.amount_lovelace) / 1e6).toFixed(2)} ADA — L2 confirmed`,
          );
        } else {
          setErrMsg(j.error ?? "pay failed");
        }
      } catch (e) {
        setErrMsg(e instanceof Error ? e.message : "pay failed");
      } finally {
        setPaying(null);
      }
    },
    [profile, head?.head?.id],
  );

  const headOpen = head?.hydra?.tag === "Open";

  return (
    <>
      <Head>
        <title>Customer Payment — Hydra PoS</title>
      </Head>
      <main className="flex min-h-screen flex-col items-center bg-black px-[5%] py-8 text-white">
        <WalletBridge onChange={setMeshState} />

        <div className="mb-6 flex w-[90vw] max-w-[640px] items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo.svg" alt="logo" width={48} height={48} className="h-9 w-9" priority />
            <h1 className="font-neue-regular text-2xl uppercase tracking-wide leading-6">
              Customer Payment
            </h1>
          </div>
          <LayerStatusPill open={headOpen} tag={head?.hydra?.tag} />
        </div>

        <div className="w-[90vw] max-w-[640px] space-y-5">
          {/* Connect wallet */}
          <GradientCard>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="font-helvetica-light text-[11px] uppercase tracking-widest text-secondary">
                  {connected ? "Connected wallet" : "Connect wallet"}
                </p>
                <p className="font-helvetica-medium text-xs text-secondary/70">
                  {connected
                    ? `${walletName ?? "Wallet"} · ${(walletL1 / 1e6).toFixed(2)} ADA`
                    : "Vespr / Eternl / Lace — you sign every L1 commit & L2 spend"}
                </p>
                {walletAddr && (
                  <p className="mt-0.5 truncate font-mono text-[10px] text-secondary/40">
                    {walletAddr}
                  </p>
                )}
              </div>
              <div className="shrink-0">
                <div className="mesh-wallet-wrap">
                  <CardanoWallet />
                </div>
              </div>
            </div>
          </GradientCard>

          {!connected && (
            <div className="rounded-lg border-2 border-[#232323] bg-[#0d0d0d] p-8 text-center">
              <p className="mx-auto max-w-sm font-helvetica-medium text-sm text-secondary">
                <b>Hybrid custody.</b> Your wallet signs the L1 commit; the server signs in-head spends with a per-customer key (a CIP-30 limitation — your wallet can&apos;t see in-head UTxOs). Connect to commit ADA into the open Hydra head and pay merchants in L2.
              </p>
            </div>
          )}

          {connected && profileBootstrapping && !profile && !needsUsername && (
            <div className="rounded-lg border-2 border-[#232323] bg-[#0d0d0d] p-6 text-center">
              <p className="font-helvetica-medium text-sm text-secondary/80">
                Looking up your profile…
              </p>
            </div>
          )}

          {connected && needsUsername && (
            <UsernamePrompt
              value={usernameInput}
              setValue={setUsernameInput}
              saving={savingUsername}
              onSubmit={() => void submitUsername()}
            />
          )}

          {connected && profile && !deepIntent && (
            <>
              <WalletBalanceCard
                profile={profile}
                walletL1={walletL1}
                walletUtxoCount={walletUtxos.length}
              />
              <CommitCard
                profile={profile}
                walletL1={walletL1}
                amount={commitAmount}
                setAmount={setCommitAmount}
                committing={committing}
                commitProgress={commitProgress}
                onCommit={() => void onCommit()}
                headOpen={headOpen}
              />

              <div className="rounded-lg border-2 border-[#232323] bg-[#0d0d0d] p-4">
                <h3 className="mb-3 font-helvetica-bold text-[13px] uppercase tracking-wider text-secondary">
                  Your intents
                </h3>
                {myIntents.length === 0 ? (
                  <p className="py-6 text-center font-helvetica-medium text-sm text-secondary/60">
                    No intents targeting you yet — the merchant will create one for you.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {myIntents.map((i) => (
                      <IntentRow
                        key={i.tx_id}
                        intent={i}
                        paying={paying === i.tx_id}
                        onPay={() => void onPay(i)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {connected && profile && deepIntent && (
            <IntentDetailCard
              intent={deepIntent}
              paying={paying === deepIntent.tx_id}
              canPay={deepIntent.customer_id === profile.id && headOpen}
              onPay={() => void onPay(deepIntent)}
            />
          )}
        </div>

        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 max-w-[90vw] rounded-lg border border-accent-blue-400/30 bg-accent-blue-500/10 px-4 py-3 font-helvetica-medium text-sm text-accent-blue-200 shadow-xl"
            >
              {toast}
            </motion.div>
          )}
        </AnimatePresence>
        {errMsg && (
          <button
            onClick={() => setErrMsg(null)}
            className="fixed bottom-6 right-6 max-w-[420px] rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-left font-helvetica-medium text-xs text-red-200 hover:bg-red-500/20"
          >
            {errMsg} <span className="opacity-50">(click to dismiss)</span>
          </button>
        )}
      </main>
    </>
  );
}

/* ─── Username prompt ────────────────────────────────────────────────────── */

function UsernamePrompt({
  value,
  setValue,
  saving,
  onSubmit,
}: {
  value: string;
  setValue: (v: string) => void;
  saving: boolean;
  onSubmit: () => void;
}) {
  const trimmed = value.trim();
  const valid = trimmed.length >= 2 && trimmed.length <= 30;
  return (
    <GradientCard>
      <div className="px-6 py-6">
        <p className="font-helvetica-light text-[11px] uppercase tracking-widest text-secondary">
          Pick a username
        </p>
        <p className="mt-1 font-helvetica-medium text-xs text-secondary/70">
          How should this wallet show up on the merchant dashboard?
        </p>

        <div className="my-4 rounded-lg bg-[#181818] px-4 py-2.5">
          <input
            type="text"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && valid && !saving) onSubmit();
            }}
            placeholder="e.g. alice, bob_42, plant store"
            maxLength={30}
            className="w-full bg-transparent font-helvetica-medium text-base text-white outline-none placeholder:text-secondary/40"
          />
        </div>

        <div className="mb-4 flex items-center justify-between font-helvetica-light text-[10px] uppercase tracking-wider text-secondary/60">
          <span>2 – 30 characters</span>
          <span>{trimmed.length}/30</span>
        </div>

        <Button variant="white" onClick={onSubmit} loading={saving} disabled={!valid || saving}>
          Continue
        </Button>

        <p className="mt-3 text-center font-helvetica-light text-[10px] uppercase tracking-wider text-secondary/40">
          You can use the same username on any device with this wallet connected.
        </p>
      </div>
    </GradientCard>
  );
}

/* ─── Wallet balance card ────────────────────────────────────────────────── */

function WalletBalanceCard({
  profile,
  walletL1,
  walletUtxoCount,
}: {
  profile: ProfileFull;
  walletL1: number;
  walletUtxoCount: number;
}) {
  return (
    <GradientCard>
      <div className="px-6 py-6">
        {profile.label && (
          <div className="mb-3 flex items-center gap-2">
            <span className="font-helvetica-light text-[10px] uppercase tracking-widest text-secondary/60">
              Signed in as
            </span>
            <span className="font-helvetica-bold text-sm text-white">{profile.label}</span>
          </div>
        )}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-helvetica-light text-[11px] uppercase tracking-widest text-secondary">
              Your in-head balance
            </p>
            <p className="font-offbit-dot-bold text-5xl leading-none">
              {(profile.l2_lovelace / 1e6).toFixed(2)} ADA
            </p>
            <p className="mt-1 font-helvetica-light text-[10px] uppercase tracking-wider text-secondary/60">
              {profile.l2_utxo_count} in-head UTxO{profile.l2_utxo_count === 1 ? "" : "s"}
            </p>
          </div>
          <div className="text-right">
            <p className="font-helvetica-light text-[11px] uppercase tracking-widest text-secondary">
              Wallet L1
            </p>
            <p className="font-helvetica-bold text-base leading-none text-secondary">
              {(walletL1 / 1e6).toFixed(2)} ADA
            </p>
            <p className="font-helvetica-light text-[10px] text-secondary/50">
              {walletUtxoCount} L1 UTxO{walletUtxoCount === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        {profile.walletAddress && (
          <div className="mt-5 flex items-center gap-2 rounded-md border border-[#232323] bg-[#181818] p-3">
            <span className="shrink-0 font-helvetica-light text-[10px] uppercase tracking-widest text-secondary/60">
              Wallet addr
            </span>
            <span className="flex-1 truncate font-mono text-[10px] text-secondary">
              {profile.walletAddress}
            </span>
            <CopyButton value={profile.walletAddress} />
          </div>
        )}
        <div className="mt-2 rounded-md border border-accent-blue-400/30 bg-accent-blue-500/5 p-3">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="font-helvetica-bold text-[10px] uppercase tracking-widest text-accent-blue-300">
              Head deposit addr · L2 settlement
            </span>
            <CopyButton value={profile.address} />
          </div>
          <span className="block truncate font-mono text-[10px] text-secondary">
            {profile.address}
          </span>
          <p className="mt-2 font-helvetica-medium text-[10px] leading-snug text-secondary/70">
            Your wallet signs the L1 send to this address. The server signs the in-head spends
            from it (Vespr can&apos;t see in-head UTxOs). On head close, any remaining L2 funds
            return here on L1 and can be withdrawn back to your wallet.
          </p>
        </div>
        {profile.l1_lovelace > 0 && (
          <p className="mt-2 text-center font-helvetica-light text-[10px] uppercase tracking-wider text-amber-300/80">
            {(profile.l1_lovelace / 1e6).toFixed(2)} ADA waiting at deposit addr — Commit will sweep it in
          </p>
        )}
      </div>
    </GradientCard>
  );
}

/* ─── Commit card (Vespr-signed) ─────────────────────────────────────────── */

function CommitCard({
  profile,
  walletL1,
  amount,
  setAmount,
  committing,
  commitProgress,
  onCommit,
  headOpen,
}: {
  profile: ProfileFull;
  walletL1: number;
  amount: string;
  setAmount: (v: string) => void;
  committing: boolean;
  commitProgress: {
    active: number;
    totalStartedAt: number;
    stepStartedAt: number;
    failedAt?: number;
    failReason?: string;
  } | null;
  onCommit: () => void;
  headOpen: boolean;
}) {
  const ada = parseFloat(amount) || 0;
  const target = Math.round(ada * 1_000_000);
  const okAmount = ada >= 2;
  const enoughWallet = walletL1 >= target + 800_000; // ~0.8 ADA fee headroom
  const canCommit = headOpen && okAmount && enoughWallet && !committing;

  return (
    <GradientCard>
      <div className="px-6 py-6">
        <div className="mb-4">
          <p className="font-helvetica-light text-[11px] uppercase tracking-widest text-secondary">
            Commit ADA into the head
          </p>
          <p className="font-helvetica-medium text-xs text-secondary/70">
            <b>One click, two steps:</b> Vespr sends ADA to your deposit address, then the server
            commits it into the head.
          </p>
        </div>

        <div className="mb-3 flex gap-2">
          <div className="flex-1 rounded-lg bg-[#181818] px-4 py-2.5">
            <input
              type="number"
              min="2"
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-transparent font-offbit-dot-bold text-2xl text-white outline-none placeholder:text-white/20"
            />
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border-2 border-[#232323] bg-white/10 px-3 py-2 font-helvetica-bold text-sm text-white">
            <Image src="/ADA.svg" alt="ADA" width={20} height={20} className="h-5 w-5 rounded-full" />
            ADA
          </div>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {[2, 5, 10, 20].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setAmount(String(v))}
              className="group rounded-full border border-[#232323] bg-[#181818] px-3 py-1 font-helvetica-bold text-xs uppercase tracking-wider text-secondary transition-all hover:text-white hover:tracking-widest"
            >
              ₳ {v}
            </button>
          ))}
        </div>

        <Button variant="white" onClick={onCommit} loading={committing} disabled={!canCommit}>
          ⚡ Commit {ada > 0 ? ada.toFixed(2) : "0.00"} ADA into Head
        </Button>

        {commitProgress && <CommitStepper progress={commitProgress} />}
        {!headOpen && (
          <p className="mt-3 text-center font-helvetica-light text-[10px] uppercase tracking-wider text-amber-300/80">
            head not open — commits paused
          </p>
        )}
        {headOpen && !okAmount && (
          <p className="mt-3 text-center font-helvetica-light text-[10px] uppercase tracking-wider text-amber-300/80">
            minimum 2 ADA (Hydra needs ≥ 2 ADA per committed UTxO)
          </p>
        )}
        {headOpen && okAmount && !enoughWallet && (
          <p className="mt-3 text-center font-helvetica-light text-[10px] uppercase tracking-wider text-amber-300/80">
            wallet has {(walletL1 / 1e6).toFixed(2)} ADA — need {ada.toFixed(2)} + ~0.8 ADA fee
          </p>
        )}
      </div>
    </GradientCard>
  );
}

/* ─── Single intent deep-link card ───────────────────────────────────────── */

function IntentDetailCard({
  intent,
  paying,
  canPay,
  onPay,
}: {
  intent: Intent;
  paying: boolean;
  canPay: boolean;
  onPay: () => void;
}) {
  const amount = Number(intent.amount_lovelace) / 1e6;
  const isPaid = intent.status === "paid";
  if (isPaid) {
    return (
      <GradientCard>
        <div className="flex flex-col items-center px-6 py-10">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full border-2 border-accent-blue-400/30 bg-accent-blue-500/10">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 13l4 4L19 7"
                stroke="#7f8eff"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h2 className="mb-2 font-offbit-dot-bold text-3xl leading-none">Payment Confirmed</h2>
          <span className="rounded-full border border-accent-blue-400/30 bg-accent-blue-500/10 px-3 py-1 font-helvetica-bold text-xs uppercase tracking-wider text-accent-blue-300">
            Settled via Hydra L2
          </span>
          <p className="mt-4 font-offbit-dot-bold text-xl">{amount.toFixed(2)} ADA</p>
        </div>
      </GradientCard>
    );
  }
  return (
    <GradientCard>
      <div className="px-6 py-6">
        <div className="mb-5 text-center">
          <span className="font-helvetica-light text-sm uppercase tracking-widest text-secondary">
            Amount Due
          </span>
          <h2 className="mt-2 font-offbit-dot-bold text-5xl leading-none">
            {amount.toFixed(2)} ADA
          </h2>
        </div>
        <Button variant="white" onClick={onPay} loading={paying} disabled={paying || !canPay}>
          ⚡ Pay {amount.toFixed(2)} ADA via Hydra L2
        </Button>
        {!canPay && (
          <p className="mt-3 text-center font-helvetica-light text-[10px] uppercase tracking-wider text-secondary/60">
            this intent isn&apos;t for your wallet — ask the merchant to retarget it
          </p>
        )}
      </div>
    </GradientCard>
  );
}

/* ─── Intent row ─────────────────────────────────────────────────────────── */

function IntentRow({
  intent,
  paying,
  onPay,
}: {
  intent: Intent;
  paying: boolean;
  onPay: () => void;
}) {
  const amount = Number(intent.amount_lovelace) / 1e6;
  return (
    <motion.div
      whileHover={intent.status === "pending" ? { x: 4 } : undefined}
      transition={{ duration: 0.2 }}
      className="flex items-center justify-between rounded-md bg-[#181818] px-3 py-2.5"
    >
      <div className="flex items-center gap-3">
        <LayerBadge layer="L2" />
        <div>
          <span className="font-offbit-dot-bold text-base">{amount.toFixed(2)} ADA</span>
          <span className="ml-2 font-mono text-[10px] text-secondary/50">
            {intent.tx_id.slice(0, 8)}…
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <IntentStatusPill status={intent.status} />
        {intent.status === "pending" && (
          <motion.button
            onClick={onPay}
            disabled={paying}
            whileHover={!paying ? { scale: 1.03 } : undefined}
            whileTap={!paying ? { scale: 1 } : undefined}
            transition={{ duration: 0.3 }}
            className="group rounded-md border border-black bg-white px-3 py-1.5 font-helvetica-bold text-[11px] uppercase tracking-wider text-black transition-all hover:tracking-widest disabled:opacity-50"
          >
            {paying ? "…" : "Pay"}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

/* ─── Commit progress stepper ───────────────────────────────────────────── */

function CommitStepper({
  progress,
}: {
  progress: {
    active: number;
    totalStartedAt: number;
    stepStartedAt: number;
    failedAt?: number;
    failReason?: string;
  };
}) {
  // Re-render once per second to update elapsed/ETA labels.
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const now = Date.now();
  const totalElapsed = Math.round((now - progress.totalStartedAt) / 1000);
  const stepElapsed = Math.round((now - progress.stepStartedAt) / 1000);
  const remainingEta = Math.max(
    0,
    COMMIT_STEPS.slice(progress.active).reduce(
      (a, s, i) => a + (i === 0 ? Math.max(0, s.estimateSec - stepElapsed) : s.estimateSec),
      0,
    ),
  );
  const failed = !!progress.failReason;

  return (
    <div className="mt-4 rounded-md border border-[#232323] bg-[#0a0a0a] p-4">
      <div className="mb-3 flex items-center justify-between font-helvetica-bold text-[10px] uppercase tracking-widest">
        <span className={failed ? "text-red-300" : "text-accent-blue-300"}>
          {failed ? "Commit failed" : "Committing — keep this tab open"}
        </span>
        <span className="text-secondary/70">
          {fmtClock(totalElapsed)}
          {!failed && remainingEta > 0 && <> · ~{fmtClock(remainingEta)} left</>}
        </span>
      </div>
      <ol className="space-y-2.5">
        {COMMIT_STEPS.map((step, i) => {
          const status: "done" | "active" | "pending" | "failed" =
            failed && i === progress.active
              ? "failed"
              : i < progress.active
              ? "done"
              : i === progress.active
              ? "active"
              : "pending";
          return (
            <li key={step.key} className="flex items-start gap-3">
              <div className="mt-[2px] shrink-0">
                <StepIcon status={status} />
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={
                    "font-helvetica-medium text-xs " +
                    (status === "done"
                      ? "text-secondary/60 line-through decoration-secondary/40"
                      : status === "active"
                      ? "text-white"
                      : status === "failed"
                      ? "text-red-200"
                      : "text-secondary/40")
                  }
                >
                  {step.label}
                </p>
                <p className="font-helvetica-light text-[10px] uppercase tracking-wider text-secondary/40">
                  {status === "active" ? (
                    <>
                      Elapsed {fmtClock(stepElapsed)} · est. {fmtClock(step.estimateSec)}
                    </>
                  ) : status === "done" ? (
                    "Done"
                  ) : status === "failed" ? (
                    progress.failReason ?? "Failed"
                  ) : (
                    <>~{fmtClock(step.estimateSec)}</>
                  )}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function StepIcon({ status }: { status: "done" | "active" | "pending" | "failed" }) {
  if (status === "done") {
    return (
      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-blue-500/20">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M5 13l4 4L19 7" stroke="#7f8eff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }
  if (status === "active") {
    return (
      <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-accent-blue-400/40">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          className="animate-spin"
          style={{ animationDuration: "1.2s" }}
        >
          <circle cx="12" cy="12" r="9" stroke="#7f8eff" strokeWidth="3" strokeOpacity="0.25" />
          <path d="M21 12a9 9 0 0 0-9-9" stroke="#7f8eff" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>
    );
  }
  if (status === "failed") {
    return (
      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500/20">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M6 6l12 12M18 6L6 18" stroke="#fca5a5" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>
    );
  }
  return <div className="h-5 w-5 rounded-full border-2 border-secondary/30" />;
}

function fmtClock(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

/* ─── Shared ─────────────────────────────────────────────────────────────── */

function LayerStatusPill({ open, tag }: { open: boolean; tag?: string }) {
  // Default label is the brand "Hydra L2" — only show a state-specific label
  // once we've heard back from the node.
  let label = "Hydra L2";
  if (open) label = "Hydra L2 Open";
  else if (tag === "Closed") label = "Head Closed";
  else if (tag === "Initial") label = "Head Initializing";
  else if (tag === "FanoutPossible" || tag === "Final" || tag === "Idle") label = `Head ${tag}`;
  return (
    <div
      className={
        "flex items-center gap-2 rounded-full border px-3 py-1.5 font-helvetica-bold text-[11px] uppercase tracking-wider " +
        (open
          ? "border-accent-blue-400/30 bg-accent-blue-500/10 text-accent-blue-300"
          : "border-white/10 bg-white/5 text-secondary")
      }
    >
      <span
        className={
          "h-2 w-2 rounded-full " +
          (open ? "bg-accent-blue-400 animate-pulse" : "bg-secondary/50")
        }
      />
      {label}
    </div>
  );
}
function LayerBadge({ layer }: { layer: string }) {
  return (
    <span className="rounded-full border border-accent-blue-400/30 bg-accent-blue-500/10 px-2 py-0.5 font-thunder-semibold text-[11px] uppercase tracking-wider text-accent-blue-300">
      {layer === "L2" ? "L2 Hydra" : layer}
    </span>
  );
}
function IntentStatusPill({ status }: { status: Intent["status"] }) {
  if (status === "paid")
    return (
      <span className="rounded-full bg-accent-blue-500/10 px-2 py-0.5 font-helvetica-bold text-[10px] uppercase tracking-wider text-accent-blue-300">
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
function GradientCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="card-shell">
      <div className="card-bg2" />
      <div className="card-fade" />
      <div className="card-inner">{children}</div>
    </div>
  );
}
function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const onClick = useCallback(async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const ta = document.createElement("textarea");
        ta.value = value;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }, [value]);
  return (
    <motion.button
      type="button"
      onClick={() => void onClick()}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 1 }}
      transition={{ duration: 0.2 }}
      className={
        "group flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 font-helvetica-bold text-[10px] uppercase tracking-wider transition " +
        (copied
          ? "border-accent-blue-400/40 bg-accent-blue-500/10 text-accent-blue-200"
          : "border-black bg-white text-black hover:bg-white/90 hover:tracking-widest")
      }
    >
      {copied ? (
        <>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          Copy
        </>
      )}
    </motion.button>
  );
}
