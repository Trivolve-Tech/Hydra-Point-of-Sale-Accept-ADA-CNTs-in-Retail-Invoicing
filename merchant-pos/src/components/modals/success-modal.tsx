import { motion } from "framer-motion";
import { FiPlus } from "react-icons/fi";
import Image from "next/image";
import { useAppStore } from "~/store";
import Button from "../button";
import AnimatedSVG from "../animated-svg";
import { useRouter } from "next/router";

const SuccessModal = () => {
  const { setModal } = useAppStore();
  const router = useRouter();

  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.8 }}
      whileInView={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="relative mx-auto flex h-[600px] w-full flex-col justify-center gap-4 overflow-hidden overflow-y-scroll rounded-lg p-1 [&::-webkit-scrollbar]:hidden"
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
      <div className="absolute left-1/2 top-0 mx-auto h-[370px] w-[370px] -translate-x-1/2">
        <AnimatedSVG />
      </div>
      <div className="bg2 flex h-full w-full flex-col items-center justify-end rounded-lg px-5 pb-3">
        <div className="absolute bottom-24 z-10 flex w-full flex-col items-center justify-center">
          <div className="mx-auto mb-2 w-full text-center gap-4 flex flex-col">
            <h1 className="font-[offbit-dot-bold] text-3xl text-white md:text-4xl">
              Transaction Completed
            </h1>
            {router.query.tx && (
              <h2 className="text-sm text-gray-400">
                Ref ID: {router.query.tx}
              </h2>
            )}
          </div>
          <h1 className="flex items-center gap-1 text-center text-lg text-secondary">
            Thank you for using{" "}
            <span className="hidden md:block">
            Trivolve Ada Payment Gateway!
            </span>
          </h1>
          <h1 className="text-center text-lg text-secondary md:hidden">
            Trivolve Ada Payment Gateway!
          </h1>
          <motion.div className="">
            <Image
              src={"/logo.svg"}
              alt="logo"
              width={1000}
              height={1000}
              className="w-[80px] py-5"
            />
          </motion.div>
        </div>

        <Button
          onClick={() => {
            setModal("HERO");
            void router.replace(router.pathname, undefined, { shallow: true });
          }}
        >
          <FiPlus size={22} />
          start new payment
        </Button>
      </div>
    </motion.section>
  );
};

export default SuccessModal;
