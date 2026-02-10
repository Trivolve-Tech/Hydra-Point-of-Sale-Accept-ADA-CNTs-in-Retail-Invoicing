import { type Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";

export default {
  content: ["./src/**/*.tsx"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", ...fontFamily.sans],
        "ibm-mono": ["var(--font-ibm-mono)"],
        inter: ["var(--font-inter)"],
        "neue-regrade": ["var(--font-neue-regrade)"],
        comfortaa: ["var(--font-comfortaa"],
      },
      colors: {
        primary: "#01c26f",
        secondary: "#949494",
      },
    },
  },
  plugins: [],
} satisfies Config;
