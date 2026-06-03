import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#fef7e8",
        ink: "#1a1a1a",
        ember: "#ff5b3a",
        mustard: "#ffb84d",
        moss: "#3f6b4f",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        stamp: "6px 6px 0 #1a1a1a",
        "stamp-sm": "3px 3px 0 #1a1a1a",
        "stamp-lg": "10px 10px 0 #1a1a1a",
      },
      borderRadius: { card: "20px" },
      transitionTimingFunction: {
        out: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
} satisfies Config;
