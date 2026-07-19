/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    fontFamily: {
      // Campaign name/role/message text now sets its own font-family
      // inline per-campaign (see src/constants/fonts.ts) rather than
      // relying on this Tailwind default, so `sans` is intentionally left
      // as Tailwind's built-in stack rather than overridden to one fixed
      // Google Font.
      nunito: ["Inter", "sans-serif"],
    },
    extend: {
      gridTemplateColumns: {
        main: "300px 1fr",
      },
    },
  },
  plugins: [],
};
