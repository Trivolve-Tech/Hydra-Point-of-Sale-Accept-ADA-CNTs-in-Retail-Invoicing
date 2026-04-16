"use server"

import { getNewPaymentAddress } from "./cardano";
import { randomUUID } from "crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

interface PaymentRecord {
  tx_id: string;
  amount: number;
  payment_address: string;
}

const DATA_DIR = join(process.cwd(), "data");
const STORE_PATH = join(DATA_DIR, "payment-records.json");

function ensureStore(): PaymentRecord[] {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(STORE_PATH)) {
    writeFileSync(STORE_PATH, "[]", "utf-8");
    return [];
  }
  return JSON.parse(readFileSync(STORE_PATH, "utf-8")) as PaymentRecord[];
}

function saveStore(records: PaymentRecord[]) {
  writeFileSync(STORE_PATH, JSON.stringify(records, null, 2), "utf-8");
}

export const getTransactionRef = async (id: string) => {
  const records = ensureStore();
  return records.find((r) => r.tx_id === id) ?? null;
};

export const createNewTx = async (amount: number) => {
  const records = ensureStore();

  const newAddress = getNewPaymentAddress(records.length + 1);
  const tx: PaymentRecord = {
    tx_id: randomUUID(),
    amount,
    payment_address: newAddress,
  };

  records.push(tx);
  saveStore(records);
  return tx;
};
