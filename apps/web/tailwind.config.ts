import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Menlo", "monospace"],
      },
      colors: {
        bg:       "#0d0e11",
        surface:  "#161920",
        "surface-2": "#1c2030",
        border:   "#1e2130",
        positive: "#26a69a",
        negative: "#ef5350",
        neutral:  "#90a4ae",
        muted:    "#546e7a",
      },
    },
  },
};

export default config;
