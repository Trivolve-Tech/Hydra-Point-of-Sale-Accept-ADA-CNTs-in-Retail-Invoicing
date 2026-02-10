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

export const getNewPaymentAddress = (count: number) => {
  const accountKey = rootKey
    .derive(harden(1852))
    .derive(harden(1815))
    .derive(harden(0))

  const utxoPubKey = accountKey
    .derive(0)
    .derive(count)
    .to_public();

  const enterpriseAddr = EnterpriseAddress.new(
    NetworkInfo.mainnet().network_id(),
    Credential.from_keyhash(utxoPubKey.to_raw_key().hash()),
  );

  return enterpriseAddr.to_address().to_bech32();
};

export const checkPaymentOnchain = async (address: string, amount: number) => {
  try {
    const response = await axios.get<{
      amount: {
        unit: string;
        quantity: string;
      }[];
    }>(`https://cardano-mainnet.blockfrost.io/api/v0/addresses/${address}`, {
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
