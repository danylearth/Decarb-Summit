/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background: '#020617',
        surface: '#020617',
        'surface-container-lowest': '#000212',
        'surface-container-low': '#050a30',
        'surface-container': '#080e3d',
        'surface-container-high': '#0c154a',
        'surface-container-highest': '#111b57',
        'primary-accent': '#c6ee62',
        'on-primary-accent': '#1a2e05',
        'on-surface': '#e2e8f0',
        'on-surface-variant': '#94a3b8',
      },
      fontFamily: {
        sans: ['PlusJakartaSans_400Regular', 'PlusJakartaSans_500Medium'],
        'sans-medium': ['PlusJakartaSans_500Medium'],
        'sans-bold': ['PlusJakartaSans_700Bold'],
        'sans-extrabold': ['PlusJakartaSans_800ExtraBold'],
        display: ['SpaceGrotesk_700Bold'],
        'display-black': ['SpaceGrotesk_700Bold'],
      },
    },
  },
  plugins: [],
};
