import { motion } from "framer-motion";
import Loader from "./loader";
import { useAppStore } from "~/store";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
}

const Button = ({ children, className, ...rest }: ButtonProps) => {
  const { loading } = useAppStore();
  return (
    <motion.div
      initial={{ scale: 1 }}
      whileHover={{ scale: 1.03 }}
      transition={{ duration: 0.3 }}
      whileTap={{ scale: 1 }}
      className={`relative z-20 w-full rounded-xl ${className}`}
    >
      <button
        className={`flex w-full items-center justify-center gap-2 border border-black bg-white py-3 text-black disabled:cursor-not-allowed disabled:opacity-50 ${loading ? "opacity-75" : "opacity-100"}`}
        {...rest}
      >
        {loading ? (
          <Loader />
        ) : (
          <div className="flex items-center gap-1 font-[helvetica-bold] text-base uppercase transition-all duration-300 group-hover:tracking-widest group-active:tracking-normal md:text-xl">
            {children}
          </div>
        )}
      </button>
    </motion.div>
  );
};

export default Button;
