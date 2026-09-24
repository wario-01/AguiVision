import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0A1830",
        panel: "#12284D",
        panel2: "#19335E",
        sidebar: "#0F2140",
        border: "#234070",
        borderMuted: "#2A4A7E",
        text: "#F5EFD6",
        muted: "#8CA0C7",
        mutedDim: "#4A5A7E",
        gold: "#F0D875",
        goldText: "#F3DE95",
        goldBgDim: "#3A3115",
        goldBorderDim: "#4A3F17",
        red: "#E6483C",
        redText: "#FDF3E7",
        amberBg: "#2B2413",
        amberText: "#FBBF24",
      },
      fontFamily: {
        display: ["Oswald", "sans-serif"],
        body: ["Manrope", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
