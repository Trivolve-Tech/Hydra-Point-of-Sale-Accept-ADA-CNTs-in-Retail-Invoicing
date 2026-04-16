"use server"

import {
  EnterpriseAddress,
  Bip32PrivateKey,
  NetworkInfo,
  Credential,
} from "@emurgo/cardano-serialization-lib-nodejs";
import axios from "axios";
import { mnemonicToEntropy } from "bip39";
import { Buffer } from "buffer";

const entropy = mnemonicToEntropy(
  process.env.WALLET_SEED_PHRASE!
);

const rootKey = Bip32PrivateKey.from_bip39_entropy(
  Buffer.from(entropy, "hex"),
  Buffer.from(""),
);

function harden(num: number): number {
  return 0x80000000 + num;
}

const isTestnet = (process.env.CARDANO_NETWORK ?? "").toLowerCase() !== "mainnet";

export const getNewPaymentAddress = (count: number) => {
  const accountKey = rootKey
    .derive(harden(1852))
    .derive(harden(1815))
    .derive(harden(0))

  const utxoPubKey = accountKey
    .derive(0)
    .derive(count)
    .to_public();

  const networkId = isTestnet
    ? NetworkInfo.testnet_preprod().network_id()
    : NetworkInfo.mainnet().network_id();

  const enterpriseAddr = EnterpriseAddress.new(
    networkId,
    Credential.from_keyhash(utxoPubKey.to_raw_key().hash()),
  );

  return enterpriseAddr.to_address().to_bech32();
};

const blockfrostUrl = process.env.BLOCKFROST_URL ?? "https://cardano-mainnet.blockfrost.io/api/v0";

type BfAmount = { unit: string; quantity: string };
type BfUtxo = { tx_hash: string; amount: BfAmount[] };

function cardanoscanBaseUrl(): string {
  const net = (process.env.CARDANO_NETWORK ?? "").trim().toLowerCase();
  if (net === "mainnet") return "https://cardanoscan.io/transaction/";
  if (net === "preview") return "https://preview.cardanoscan.io/transaction/";
  return "https://preprod.cardanoscan.io/transaction/";
}

export function cardanoscanTxUrl(txHash: string): string {
  return `${cardanoscanBaseUrl()}${txHash}`;
}

/**
 * Creating tx hash of the UTxO with the most lovelace at this address
 * (heuristic when a single deposit funds the payment).
 */
export async function resolvePrimaryFundingTxHash(
  address: string,
): Promise<string | null> {
  try {
    const { data, status } = await axios.get<BfUtxo[]>(
      `${blockfrostUrl}/addresses/${address}/utxos`,
      {
        headers: { project_id: process.env.BLOCKFROST_KEY },
        validateStatus: () => true,
      },
    );
    if (status === 404 || !Array.isArray(data) || data.length === 0) {
      return null;
    }

    let best: { tx_hash: string; lovelace: bigint } | null = null;
    for (const u of data) {
      const l = u.amount?.find((a) => a.unit === "lovelace")?.quantity;
      if (!l) continue;
      const lv = BigInt(l);
      if (!best || lv > best.lovelace) {
        best = { tx_hash: u.tx_hash, lovelace: lv };
      }
    }
    return best?.tx_hash ?? null;
  } catch {
    return null;
  }
}

export const checkPaymentOnchain = async (address: string, amount: number) => {
  try {
    const response = await axios.get<{
      amount: {
        unit: string;
        quantity: string;
      }[];
    }>(`${blockfrostUrl}/addresses/${address}`, {
      headers: {
        project_id: process.env.BLOCKFROST_KEY,
      },
    });

    const lovelaceAmount = response.data.amount.find(
      (asset) => asset.unit === "lovelace",
    )?.quantity;
    return amount <= (lovelaceAmount ? parseInt(lovelaceAmount) / 1_000_000 : 0)
      ? 1
      : 0;
  } catch (error) {
    console.log(error);
    return 0;
  }
};
