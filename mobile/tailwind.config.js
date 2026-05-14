/** @type {import('tailwindcss').Config} */
// 색상은 global.css의 CSS 변수에서 가져온다 (OS prefers-color-scheme로 자동 전환).
// 새 토큰 추가 시 global.css의 :root 와 dark @media 양쪽을 함께 갱신할 것.
const withVar = (name) => `rgb(var(--color-${name}) / <alpha-value>)`;

const semanticColors = [
  'brand-primary', 'brand-primary-strong',
  'brand-secondary', 'brand-secondary-strong',
  'triple-blue', 'triple-blue-strong',
  'tx-primary', 'tx-secondary', 'tx-tertiary', 'tx-disabled', 'tx-inverse', 'tx-brand', 'tx-danger',
  'bg-base', 'bg-surface', 'bg-subtle', 'bg-strong',
  'line-default', 'line-strong', 'line-focus',
  'state-success', 'state-warning', 'state-danger', 'state-info',
];

const colors = Object.fromEntries(semanticColors.map((k) => [k, withVar(k)]));

module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'media',
  theme: {
    extend: {
      colors,
      borderRadius: {
        xs: '4px',
        sm: '6px',
      },
    },
  },
  plugins: [],
};
