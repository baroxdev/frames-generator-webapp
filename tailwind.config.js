/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    fontFamily: {
      sans: ['Inter, sans-serif'],
    },
    extend: {
      gridTemplateColumns: {
        main: '300px 1fr',
      },
    },
  },
  plugins: [],
};
