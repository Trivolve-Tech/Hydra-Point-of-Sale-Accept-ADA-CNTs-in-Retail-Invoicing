import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { MdDone } from "react-icons/md";

import { useAppStore } from "~/store";
import Button from "../button";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import type { Currency } from "~/types";
import { useRouter } from "next/router";
import toast from "react-hot-toast";

const Hero = () => {
  const { setLoading, setModal } = useAppStore();
  const [amount, setAmount] = useState<number>(0);

  const router = useRouter();

  const { data } = useQuery<Record<Currency, number>>({
    queryKey: ["adaPrice"],
    queryFn: async ({ signal }) => {
      const response = await axios.get<Record<Currency, number>>(
        "/api/adaprice",
        {
          signal,
        },
      );
      return response.data;
    },
  });

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(Number(event.target.value));
  };

  const confirmPayment = async (amount: number) => {
    try {
      if (!amount) {
        toast.error("Invalid input amount !");
        return;
      }
      setLoading(true);
      const response = await axios.post<{
        tx_id: string;
        amount: string;
        payment_address: string;
      }>("/api/payment", { amount });

      console.log(response.data);

      void router.push(`?tx=${response.data.tx_id}`);

      setLoading(false);
      setModal("PAYMENT");
      return response.data;
    } catch (error) {
      console.error("Error calling payment API:", error);
      throw error;
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="relative mx-auto flex h-full w-full flex-col justify-center gap-4 overflow-hidden overflow-y-scroll rounded-lg p-1 [&::-webkit-scrollbar]:hidden"
    >
      <div className="flex w-full flex-col items-center justify-center">
        <Image
          src={"/logo.svg"}
          alt="logo"
          width={1000}
          height={1000}
          className="mb-8 w-[80px]"
        />
        <h1 className="font-[offbit-dot-bold] text-2xl leading-6 md:text-[26px]">
          Trivolve ADA Payment Gateway
        </h1>
        <h1 className="mt-1 text-[16px] text-[#949494]">
          Fill the transaction details
        </h1>
      </div>
      <div
        className="relative mt-2 h-full w-full overflow-hidden rounded-lg p-0.5"
        style={{
          background:
            "linear-gradient(295.17deg, rgba(21, 21, 21, 0.16) 2.58%, rgba(255, 255, 255, 0.07) 97.17%)",
        }}
      >
        <div
          className="absolute inset-0 z-10 h-full w-full"
          style={{
            background:
              "linear-gradient(179.77deg, rgba(0, 0, 0, 0) 0.2%, #101010 99.8%)",
          }}
        />
        <div className="bg2 h-full w-full rounded-lg px-6 py-[5%]">
          {/* VND */}
          <div className="relative z-20 my-5 flex w-full items-center justify-between rounded-lg bg-[#181818] px-4 py-2.5 pr-6">
            <div className="w-[90%]">
              <label htmlFor="vnd" className="text-sm text-secondary">
                Amount to be
              </label>
              <input
                type="number"
                name="vnd"
                step={0.1}
                min={0}
                value={amount}
                onChange={handleChange}
                onClick={(e) => e.currentTarget.select()}
                onScroll={(e) => (e.currentTarget.style.pointerEvents = "none")}
                className="mt-2 w-full bg-transparent font-[offbit-dot-bold] text-2xl font-bold outline-none placeholder:text-white"
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 overflow-hidden rounded-full">
                <Image
                  src={"/vnd.svg"}
                  alt="logo"
                  height={1000}
                  width={1000}
                  className="h-full w-full rounded-full object-cover"
                />
              </div>
              <span className="text-lg font-bold tracking-wider">VND</span>
            </div>
          </div>

          {/* ADA */}
          <div className="relative z-20 my-5 flex w-full items-center justify-between rounded-lg border-2 border-[#232323] px-4 py-2.5 pr-6">
            <label htmlFor="ada" className="text-sm font-bold text-secondary">
              You get
            </label>

            <div className="flex items-center gap-2">
              <div className="font-helvetica inline-flex min-w-fit items-center gap-1 text-[14px]">
                {data?.vnd ? (
                  `${(amount / data?.vnd).toFixed(2)} ADA`
                ) : (
                  <span className="animate-pulse">
                    Fetching ADA price . . . .
                  </span>
                )}
              </div>
              <Image
                src={"/ada.svg"}
                alt="logo"
                height={1000}
                width={1000}
                className="h-full w-full rounded-full object-cover"
              />
            </div>
          </div>

          {/*Confirm */}
          <Button
            onClick={() =>
              data?.vnd
                ? confirmPayment(parseFloat((amount / data?.vnd).toFixed(2)))
                : {}
            }
          >
            <MdDone size={22} />
            Confirm
          </Button>
        </div>
      </div>
    </motion.section>
  );
};

export default Hero;
