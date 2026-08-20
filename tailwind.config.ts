import type { Config } from "tailwindcss";

/**
 * Design tokens — the single source of truth for Gart Dash's look (dark theme).
 *
 * Style components with these SEMANTIC names (role, not hue): `bg-surface`,
 * `text-ink-muted`, `bg-pos-qb`, `bg-group-gart`, `text-accent` — NEVER raw
 * Tailwind colors in a component. To restyle / rebrand / add a light theme later,
 * change values HERE and every component follows.
 *
 * See docs/architecture.md → "Styling & design tokens" and decision_log D-02, D-03.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // --- Neutral base (dark) ---
        surface: {
          DEFAULT: "#161d2b", // cards, table surface
          muted: "#0f1420", // page background (darkest)
          subtle: "#1e2738", // hover / raised rows
          raised: "#232d40", // controls (inputs, buttons)
        },
        ink: {
          DEFAULT: "#e6ebf2", // primary text
          muted: "#9aa7bd", // secondary text
          subtle: "#6b7a93", // labels, captions
          faint: "#4a5670", // disabled / empty
        },
        line: {
          DEFAULT: "#2a3548", // default borders / dividers
          subtle: "#212b3d", // faint row dividers
          strong: "#3a4760", // control borders / emphasis
        },
        // --- Teal/cyan accent ---
        accent: {
          DEFAULT: "#2dd4bf", // active / selected / links
          strong: "#14b8a6", // pressed
          soft: "#193640", // subtle accent-tinted fill
          contrast: "#04231f", // text on an accent fill
        },
        brand: { DEFAULT: "#2dd4bf", contrast: "#04231f" },

        // --- Position badge fills (white text sits on these) ---
        pos: {
          qb: "#15803d", // dark green
          rb: "#b91c1c", // dark red
          wr: "#1d4ed8", // dark blue
          te: "#8a6a3b", // dark tan
          dst: "#7e22ce", // purple
        },

        // --- Column-group tints (subtle, on dark) + a legend swatch each ---
        group: {
          gart: "#15242e", // GartStats (teal-leaning)
          "gart-key": "#2dd4bf",
          market: "#1a2233", // Market (neutral)
          "market-key": "#8aa0c6",
          contract: "#211e17", // Contract Info (warm)
          "contract-key": "#c9a24b",
        },

        // --- Tier separator band (FantasyPros-style) ---
        tier: {
          band: "#1b2740",
          text: "#93a4c6",
          line: "#3a4760",
        },

        // --- Edge column: green above market, red below ---
        edge: {
          DEFAULT: "#c3ccdb", // zero
          up: "#34d399", // we value above market
          down: "#f87171", // we value below market
        },

        // --- MOCK-DATA warning banner (stays high-visibility on dark) ---
        warning: {
          surface: "#f59e0b",
          border: "#b45309",
          text: "#1a1205",
          hover: "#1f2636",
        },
      },
    },
  },
  plugins: [],
};

export default config;
