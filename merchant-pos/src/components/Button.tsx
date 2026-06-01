import { motion } from "framer-motion";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "white" | "blue" | "ghost";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: Variant;
  loading?: boolean;
  className?: string;
}

/**
 * Trivolve-style primary action button — lifted from merchant-pos/Button.tsx
 * with explicit variants for the white CTA, the blue Hydra L2 accent, and a
 * dark ghost variant. Hover expands letter-spacing (`tracking-widest`) and
 * subtly scales the wrapper (`scale: 1.03`) — the signature trivolvetech.com
 * micro-interaction.
 */
export default function Button({
  children,
  variant = "white",
  loading = false,
  disabled,
  className = "",
  ...rest
}: Props) {
  const base =
    "group relative flex w-full items-center justify-center gap-2 rounded-xl font-helvetica-bold text-base md:text-lg uppercase tracking-wider transition-all duration-300 group-hover:tracking-widest group-active:tracking-normal disabled:cursor-not-allowed disabled:opacity-50 px-6 py-3";

  const styles: Record<Variant, string> = {
    white: "border border-black bg-white text-black hover:bg-white/95",
    blue:
      "border border-accent-blue-400/40 bg-accent-blue-500/15 text-accent-blue-200 hover:bg-accent-blue-500/25 hover:text-accent-blue-100",
    ghost:
      "border border-[#232323] bg-[#181818] text-secondary hover:border-white/20 hover:text-white",
  };

  return (
    <motion.div
      initial={{ scale: 1 }}
      whileHover={disabled || loading ? undefined : { scale: 1.03 }}
      whileTap={disabled || loading ? undefined : { scale: 1 }}
      transition={{ duration: 0.3 }}
      className="relative z-20 w-full"
    >
      <button
        type="button"
        disabled={disabled || loading}
        className={`${base} ${styles[variant]} ${className}`}
        {...rest}
      >
        {loading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <span className="flex items-center gap-2 transition-all duration-300 group-hover:tracking-widest">
            {children}
          </span>
        )}
      </button>
    </motion.div>
  );
}
