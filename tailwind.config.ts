import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0B0B12",
        panel: "#12121C",
        border: "#242433",
        glowPink: "#ff2fb0",
        glowPurple: "#a855f7",
        text: {
          primary: "#F5F5FA",
          secondary: "#9C9CB5",
          muted: "#6B6B85",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        glow: "0 0 24px rgba(255, 47, 176, 0.35)",
        "glow-sm": "0 0 12px rgba(168, 85, 247, 0.35)",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};
export default config;
