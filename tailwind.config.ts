import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#003C71",
        panel: "#0A2F5C",
        panel2: "#0F4580",
        sidebar: "#002F5A",
        border: "#2467A8",
        borderMuted: "#2F74B8",
        text: "#FFFFFF",
        cream: "#EFE6C2", // resalte de lo seleccionado (equipo / pestaña)
        muted: "#A9C0DD",
        mutedDim: "#6C8CB3",
        gold: "#F9E547",
        goldText: "#FBEB7A",
        goldBgDim: "#3E4520",
        goldBorderDim: "#5C6325",
        red: "#E6483C",
        redText: "#FDF3E7",
        ok: "#4ADE80",
        amberBg: "#2B2413",
        amberText: "#FBBF24",
      },
      fontFamily: {
        brand: ["Avant Garde", "Century Gothic", "Futura", "sans-serif"],
        display: ["Avant Garde", "Century Gothic", "Futura", "sans-serif"],
        body: ["Montserrat", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
