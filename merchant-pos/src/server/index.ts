"use server"

import { createClient } from "@supabase/supabase-js";
import { getNewPaymentAddress } from "./cardano";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export const getTransactionRef = async (id: string) => {
  const { data: tx } = await supabase
    .from("payment-records")
    .select("*")
    .eq("tx_id", id)
    .returns<
      {
        amount: number;
        payment_address: string;
      }[]
    >()
    .maybeSingle();

  return tx;
};

export const createNewTx = async (amount: number) => {
  const { count } = await supabase
    .from("payment-records")
    .select("*", { count: "exact", head: true });

  const newAddress = getNewPaymentAddress((count ?? 0) + 1);

  const { data: tx } = await supabase
    .from("payment-records")
    .insert([
      {
        amount,
        payment_address: newAddress,
      },
    ])
    .select()
    .returns<{
      tx_id: string;
      amount: number;
      payment_address: string;
    }>()
    .maybeSingle();

  return tx;
};
