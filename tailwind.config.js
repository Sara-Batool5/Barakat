/** @type {import('tailwindcss').Config} */
const c = (name) => `hsl(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: c("background"),
        surface: c("surface"),
        "surface-raised": c("surface-raised"),
        border: c("border"),
        foreground: c("foreground"),
        "muted-foreground": c("muted-foreground"),
        subtle: c("subtle"),
        primary: {
          DEFAULT: c("primary"),
          dark: c("primary-dark"),
          light: c("primary-light"),
          muted: c("primary-muted"),
        },
        "dark-green": c("dark-green"),
        "dark-surface": c("dark-surface"),
        "dark-border": c("dark-border"),
        amber: { DEFAULT: c("amber"), light: c("amber-light") },
        danger: { DEFAULT: c("danger"), light: c("danger-light") },
      },
      fontFamily: {
        sans: ["Sora", "Cairo", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
