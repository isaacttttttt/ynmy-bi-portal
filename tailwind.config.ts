import type { Config } from "tailwindcss"

const config = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      // 使用 clamp() 实现流式字体
      fontSize: {
        'xxs': 'clamp(0.625rem, 0.573vw, 0.688rem)',      // 11px
        'xs': 'clamp(0.688rem, 0.625vw, 0.75rem)',        // 12px
        'sm': 'clamp(0.75rem, 0.677vw, 0.813rem)',        // 13px
        'base': 'clamp(0.813rem, 0.781vw, 0.938rem)',     // 15px
        'md': 'clamp(0.875rem, 0.833vw, 1rem)',           // 16px
        'lg': 'clamp(0.938rem, 0.885vw, 1.063rem)',       // 17px
        'xl': 'clamp(1.125rem, 1.146vw, 1.375rem)',       // 22px
      },

      // 流式间距
      spacing: {
        'page-x': 'clamp(1rem, 1.25vw, 1.5rem)',           // 页面左右边距
        'page-y': 'clamp(1.25rem, 1.667vw, 2rem)',         // 页面上下边距
        'module': 'clamp(0.875rem, 1.042vw, 1.25rem)',     // 模块间距 20px
        'card': 'clamp(0.625rem, 0.833vw, 1rem)',          // 卡片间距 16px
        'item': 'clamp(0.5rem, 0.625vw, 0.75rem)',         // 条目间距 12px
        'compact': 'clamp(0.313rem, 0.417vw, 0.5rem)',     // 紧凑间距 8px

        // 模块高度
        'workbench-h': 'clamp(22rem, 23.958vw, 28.75rem)',
        'thematic-h': 'clamp(15rem, 16.719vw, 20.063rem)',
        'notice-h': 'clamp(18rem, 20.365vw, 24.438rem)',
        'quickentry-h': 'clamp(18rem, 20.313vw, 24.375rem)',

        // 卡片尺寸
        'card-report-h': 'clamp(7rem, 9.375vw, 9.25rem)',
        'card-horizontal-h': 'clamp(4.5rem, 5.729vw, 6rem)',

        // 图标尺寸
        'icon-xs': 'clamp(0.875rem, 1.042vw, 1.25rem)',
        'icon-sm': 'clamp(1.25rem, 1.458vw, 1.75rem)',
        'icon-md': 'clamp(1.75rem, 1.875vw, 2.25rem)',
        'icon-lg': 'clamp(2rem, 2.083vw, 2.5rem)',
        'icon-xl': 'clamp(2.5rem, 2.708vw, 3.25rem)',
      },

      // 流式圆角
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        'fluid-sm': 'clamp(0.375rem, 0.417vw, 0.5rem)',
        'fluid-md': 'clamp(0.625rem, 0.625vw, 0.75rem)',
        'fluid-lg': 'clamp(0.875rem, 0.833vw, 1rem)',
        'fluid-xl': 'clamp(1rem, 1.042vw, 1.25rem)',
      },

      // 最大宽度
      maxWidth: {
        'container': '90rem', // 1440px
      },

      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config
