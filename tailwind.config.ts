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
        // India National AQI Bands
        aqi: {
          good: "#059669",        // 0 - 50 (Green)
          satisfactory: "#65a30d",// 51 - 100 (Light Green)
          moderate: "#d97706",    // 101 - 200 (Yellow / Orange)
          poor: "#ea580c",        // 201 - 300 (Orange / Red-Orange)
          verypoor: "#dc2626",    // 301 - 400 (Red)
          severe: "#7f1d1d",      // 401 - 500+ (Dark Maroon / Purple)
        },
      },
    },
  },
  plugins: [],
};

export default config;
