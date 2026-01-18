import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Phil's color palette - dark, cozy, livestream vibes
        'stream-dark': '#0f0f0f',
        'stream-gray': '#1a1a1a',
        'stream-border': '#2a2a2a',
        'stream-text': '#e5e5e5',
        'stream-muted': '#888888',
        'live-red': '#ff4444',
        'phil-brown': '#8B4513',
      },
    },
  },
  plugins: [],
}
export default config
