/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    fontFamily: {
      sans: ['Roboto, san-serif'],
    },
    extend: {
      gridTemplateColumns: {
        main: '300px 1fr',
      },
    },
  },
  plugins: [],
};
