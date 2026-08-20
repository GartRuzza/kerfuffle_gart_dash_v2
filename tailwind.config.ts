import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors";

/**
 * Design tokens — the single source of truth for Gart Dash's look.
 *
 * Style components with these SEMANTIC names (role, not hue): `bg-yours-surface`,
 * `text-edge-up`, `bg-tier-1`, `text-ink-muted`, `border-line` — NEVER raw Tailwind
 * colors like `bg-sky-50` in a component. To restyle the app (or add dark mode / a
 * rebrand), change the values HERE and every current and future component follows.
 *
 * See docs/architecture.md → "Styling & design tokens" and decision_log D-02.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // --- Neutral base (the app's grays) ---
        surface: {
          DEFAULT: colors.white, // cards, inputs, buttons
          muted: colors.slate[50], // page background
          subtle: colors.slate[100], // hover / faint fills
        },
        ink: {
          DEFAULT: colors.slate[900], // primary text
          muted: colors.slate[600], // secondary text
          subtle: colors.slate[500], // labels, captions
          faint: colors.slate[400], // de-emphasized / empty
        },
        line: {
          DEFAULT: colors.slate[200], // default borders / dividers
          subtle: colors.slate[100], // faint row dividers
          strong: colors.slate[300], // input / control borders
        },
        brand: {
          DEFAULT: colors.slate[900], // primary/active control
          contrast: colors.white, // text on brand
        },

        // --- "Yours": the owner's KERFUFFLE numbers ---
        yours: {
          surface: colors.sky[50], // column tint
          header: colors.sky[100], // group-header tint
          border: colors.sky[300], // input border
          focus: colors.sky[500], // input focus ring
          text: colors.sky[800],
          strong: colors.sky[900],
        },
        // --- "The Market": consensus / price ---
        market: {
          surface: colors.slate[100], // column tint
          header: colors.slate[200], // group-header tint
          text: colors.slate[700],
        },
        // --- Edge: the gap between the two ---
        edge: {
          up: colors.emerald[600], // we value above market
          down: colors.rose[600], // we value below market
          flat: colors.slate[400], // no gap
          surface: colors.emerald[50], // column tint
          text: colors.emerald[800], // group-header text
        },
        // --- Tier badges (1 = best) ---
        tier: {
          "1": colors.violet[600],
          "2": colors.blue[600],
          "3": colors.emerald[600],
          "4": colors.amber[500],
          "5": colors.orange[500],
          "6": colors.rose[500],
        },
        // --- MOCK-DATA warning banner ---
        warning: {
          surface: colors.amber[400],
          border: colors.amber[500],
          text: colors.amber[950],
          hover: colors.amber[50], // row hover accent
        },
      },
    },
  },
  plugins: [],
};

export default config;
