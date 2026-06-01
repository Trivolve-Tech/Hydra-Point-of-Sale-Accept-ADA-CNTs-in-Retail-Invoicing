import { type Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Trivolve type system (verbatim from trivolvetech.com)
        "thunder-bold":      ["thunder-bold", "sans-serif"],
        "thunder-extrabold": ["thunder-extrabold", "sans-serif"],
        "thunder-semibold":  ["thunder-semibold", "sans-serif"],
        "neue-regular":      ["neue-regular", "sans-serif"],
        "neue-light":        ["neue-light", "sans-serif"],
        "neue-ultra-bold":   ["neue-ultra-bold", "sans-serif"],
        "offbit-regular":    ["offbit-regular", "monospace"],
        "offbit-101":        ["offbit-101", "monospace"],
        "offbit-101-bold":   ["offbit-101-bold", "monospace"],
        "offbit-bold":       ["offbit-bold", "monospace"],
        "offbit-dot":        ["offbit-dot", "monospace"],
        "offbit-dot-bold":   ["offbit-dot-bold", "monospace"],
        "helvetica-light":   ["helvetica-light", "Helvetica Neue", "sans-serif"],
        "helvetica-regular": ["helvetica-regular", "Helvetica Neue", "sans-serif"],
        "helvetica-medium":  ["helvetica-medium", "Helvetica Neue", "sans-serif"],
        "helvetica-bold":    ["helvetica-bold", "Helvetica Neue", "sans-serif"],
      },
      colors: {
        // Brand (from trivolvetech.com)
        "trivolve-blue":   "#0018fe",
        "trivolve-red":    "#A91113",
        "trivolve-purple": "#240EAC",
        "trivolve-grey":   "#AFAFAF",

        // Accent ramp — derived from #0018fe. Replaces the cyan-* utilities
        // that were a v1 stand-in. Lighter shades tuned for readability on
        // pure black at small text sizes.
        "accent-blue-50":  "#eef0ff",
        "accent-blue-100": "#d6daff",
        "accent-blue-200": "#aab3ff",
        "accent-blue-300": "#7f8eff",
        "accent-blue-400": "#5466ff",
        "accent-blue-500": "#0018fe",
        "accent-blue-600": "#0014cc",

        // App
        primary: "#01c26f",
        secondary: "#949494",
      },
    },
  },
  plugins: [],
} satisfies Config;
