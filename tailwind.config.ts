import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        hush: {
          'bg-dark': '#111827',
          'bg-element': '#23304b',
          'bg-hover': '#2A2A3E',
          'purple': '#A78BFA',
          'purple-hover': '#8B5CF6',
          'text-primary': '#efe8f6',
          'text-accent': '#C4B5FD',
        }
      },
      borderRadius: {
        'bubble-sent': '18px 18px 4px 18px',
        'bubble-received': '18px 18px 18px 4px',
      },
      animation: {
        'slide-in': 'slideIn 0.3s ease-out',
        'fade-out': 'fadeOut 0.3s ease-in forwards',
      },
      keyframes: {
        slideIn: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
