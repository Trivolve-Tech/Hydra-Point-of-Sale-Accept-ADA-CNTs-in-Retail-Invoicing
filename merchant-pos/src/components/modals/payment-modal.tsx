import axios from "axios";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import QRCode from "react-qr-code";
import toast from "react-hot-toast";
import "react-loading-skeleton/dist/skeleton.css";

import ProgressFlow from "../progress-bar";
import { useAppStore } from "~/store";
import SkeletonLoading from "../skeleton-loading";
import useDeviceType from "~/hooks/use-device-type";

const PaymentModal = () => {
  const { setModal } = useAppStore();

  const deviceType = useDeviceType();

  const router = useRouter();

  const { tx } = router.query;

  const { data } = useQuery<{
    status: 0 | 1;
    payment_address: string;
    amount: number;
  }>({
    queryKey: ["paymentStatus", tx],
    queryFn: async ({ signal }) => {
      const response = await axios.get<{
        status: 0 | 1;
        payment_address: string;
        amount: number;
      }>(`/api/payment?tx=${tx as string}`, {
        signal,
      });

      if (response?.data?.status === 1) {
        setModal("SUCCESS");
      }

      return response.data;
    },
    refetchInterval: 2000,
  });

  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.8 }}
      whileInView={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="relative mx-auto flex h-full w-full flex-col justify-center gap-4 overflow-hidden overflow-y-scroll rounded-lg p-1 [&::-webkit-scrollbar]:hidden"
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
      <div className="bg2 h-full w-full rounded-lg px-5 py-[5%]">
        <div>
          <div className="relative z-20 mb-16">
            <ProgressFlow currentStep={data?.status ?? 0} />
          </div>
          <div className="relative z-20 flex h-auto w-full flex-col justify-between space-y-8 rounded-lg bg-[#181818] p-3 md:flex-row md:space-y-0">
            <div className="mx-2 flex flex-1 flex-col gap-4 py-2">
              <div>
                <h1 className="mb-1.5 text-[14px] text-secondary">Amount</h1>
                {data?.amount ? (
                  <span className="font-[offbit-dot-bold] text-lg">
                    {data?.amount} ADA
                  </span>
                ) : (
                  <div className="w-full md:w-[90%]">
                    <SkeletonLoading height={30} />
                  </div>
                )}
              </div>
              <div>
                <h1 className="mb-1.5 text-[14px] text-secondary">
                  To this address
                </h1>
                {data?.payment_address ? (
                  <span
                    className="block w-full max-w-[260px] cursor-pointer truncate break-words font-[offbit-dot-bold] text-lg"
                    onClick={() => {
                      if (data?.payment_address) {
                        void navigator.clipboard.writeText(
                          data.payment_address,
                        );
                        toast.success("Address copied successfully !");
                      }
                    }}
                  >
                    {data?.payment_address}
                  </span>
                ) : (
                  <div className="w-full md:w-[90%]">
                    <SkeletonLoading height={30} />
                  </div>
                )}
              </div>
            </div>
            {data?.payment_address ? (
              <div className="flex h-full w-full flex-1 justify-center rounded-lg bg-white p-2 md:h-[207px] md:max-w-[207px] md:justify-normal">
                <QRCode
                  className="h-[90%] w-[90%] object-cover md:h-full md:w-full"
                  value={data?.payment_address}
                />
              </div>
            ) : (
              <div className="w-full md:w-[40%] md:max-w-[207px]">
                <SkeletonLoading height={deviceType === "mobile" ? 300 : 207} />
              </div>
            )}
          </div>
        </div>

        <div className="relative z-20 mt-2 flex h-auto w-full flex-col justify-between space-y-8 rounded-lg border-[2px] border-[#181818] px-3 md:flex-row md:space-y-0">
          <div className="ml-3 flex flex-1 flex-col gap-4 py-2">
            <div>
              <h1 className="mb-1.5 text-[14px] text-secondary">You get</h1>
              {data?.amount ? (
                <span className="font-[offbit-dot-bold] text-lg">
                  {" "}
                  {data?.amount} ADA
                </span>
              ) : (
                <SkeletonLoading height={30} />
              )}
            </div>
            <div className="mb-1">
              <h1 className="mb-1.5 text-[14px] text-secondary">
                Reciepient wallet
              </h1>
              {data?.payment_address ? (
                <span className="block w-full max-w-[260px] truncate break-words font-[offbit-dot-bold] text-lg">
                  {data?.payment_address}
                </span>
              ) : (
                <SkeletonLoading height={30} />
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
};

export default PaymentModal;
