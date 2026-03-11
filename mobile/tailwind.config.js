/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        hade: {
          black: "#0D0D0D",
          surface: "#1A1A1A",
          white: "#FAFAF8",
          gray: "#A8A29E",
          muted: "#78716C",
          dim: "#57534E",
          green: "#22C55E",
          blue: "#3B82F6",
          amber: "#F59E0B",
          red: "#EF4444",
        },
      },
      fontFamily: {
        sans: ["Inter"],
        display: ["BricolageGrotesque"],
        fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
      },
      borderRadius: {
        hade: "12px",
      },
    },
  },
  plugins: [],
};
