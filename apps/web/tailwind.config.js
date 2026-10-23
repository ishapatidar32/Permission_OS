/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: { fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui'], mono: ['JetBrains Mono', 'monospace'] }, boxShadow: { glow: '0 0 0 1px rgba(99,102,241,.12), 0 18px 50px rgba(2,6,23,.22)' } } },
  plugins: [],
};
