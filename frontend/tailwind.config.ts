import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#2D4A2E",
          50: "#f0f7f0",
          100: "#d9eed9",
          200: "#b3ddb5",
          300: "#82c587",
          400: "#52a858",
          500: "#2D4A2E",
          600: "#243d25",
          700: "#1b2f1c",
        },
        accent: {
          DEFAULT: "#A8E6CF",
          light: "#d4f5e4",
          dark: "#6dd4a8",
        },
        warm: "#FAFAFA",
        surface: "#FFFFFF",
        danger: "#FF4B4B",
        success: "#34C759",
        "text-primary": "#191F28",
        "text-secondary": "#8B95A1",
        "text-tertiary": "#B0B8C1",
        "border-default": "#E5E8EB",
        "border-light": "#F2F4F6",
        "bg-secondary": "#F7F8FA",
      },
      fontFamily: {
        title: ["'Pretendard'", "'Noto Sans KR'", "sans-serif"],
        body: ["'Pretendard'", "'Noto Sans KR'", "sans-serif"],
        en: ["'Poppins'", "sans-serif"],
      },
      borderRadius: {
        card: "20px",
        button: "16px",
        pill: "9999px",
        input: "14px",
      },
      boxShadow: {
        soft: "0 2px 8px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)",
        card: "0 4px 16px rgba(0, 0, 0, 0.06)",
        hover: "0 8px 24px rgba(0, 0, 0, 0.08)",
        float: "0 8px 32px rgba(0, 0, 0, 0.12)",
        nav: "0 -2px 16px rgba(0, 0, 0, 0.06)",
      },
      screens: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
