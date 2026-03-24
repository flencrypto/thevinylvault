/**
 * VinylVault Design Tokens
 *
 * Single source of truth that mirrors both:
 *   - src/index.css CSS variables (runtime)
 *   - public/figma-tokens.json (Figma Tokens Studio)
 *
 * Import this file anywhere in the codebase to reference tokens
 * programmatically (e.g. in canvas/SVG rendering or Recharts themes).
 *
 * To sync with Figma:
 *   1. Install the "Tokens Studio for Figma" plugin in Figma.
 *   2. Point the plugin at `public/figma-tokens.json` (URL or local file).
 *   3. Changes in Figma can be exported back to that file; run a one-liner
 *      to regenerate this TypeScript file from the JSON.
 */

// ─── Color Palette ────────────────────────────────────────────────────────────

export const colors = {
  purple: {
    50:  'oklch(0.97 0.01 265)',
    100: 'oklch(0.93 0.03 265)',
    200: 'oklch(0.85 0.05 265)',
    300: 'oklch(0.72 0.08 265)',
    400: 'oklch(0.58 0.12 265)',
    500: 'oklch(0.45 0.15 265)',
    600: 'oklch(0.35 0.15 265)',
    700: 'oklch(0.28 0.13 265)',
    800: 'oklch(0.20 0.08 265)',
    900: 'oklch(0.15 0.05 265)',
    950: 'oklch(0.10 0.03 265)',
  },
  amber: {
    50:  'oklch(0.98 0.02 80)',
    100: 'oklch(0.95 0.06 75)',
    200: 'oklch(0.90 0.10 70)',
    300: 'oklch(0.84 0.14 65)',
    400: 'oklch(0.78 0.16 62)',
    500: 'oklch(0.70 0.18 60)',
    600: 'oklch(0.60 0.16 58)',
    700: 'oklch(0.50 0.14 55)',
    800: 'oklch(0.40 0.10 52)',
    900: 'oklch(0.30 0.07 50)',
  },
  slate: {
    50:  'oklch(0.98 0.005 265)',
    100: 'oklch(0.94 0.01 265)',
    200: 'oklch(0.87 0.015 265)',
    300: 'oklch(0.74 0.02 265)',
    400: 'oklch(0.60 0.025 265)',
    500: 'oklch(0.50 0.025 265)',
    600: 'oklch(0.40 0.02 265)',
    700: 'oklch(0.30 0.015 265)',
    800: 'oklch(0.22 0.012 265)',
    900: 'oklch(0.16 0.01 265)',
    950: 'oklch(0.10 0.008 265)',
  },
  red:   { 500: 'oklch(0.55 0.22 25)', 600: 'oklch(0.45 0.20 22)' },
  green: { 400: 'oklch(0.72 0.17 145)', 500: 'oklch(0.62 0.18 145)' },
  white: '#ffffff',
  black: '#000000',
} as const

// ─── Semantic Aliases (map to CSS variables) ──────────────────────────────────

export const semantic = {
  background:        colors.slate[950],
  foreground:        colors.slate[50],
  card:              colors.slate[900],
  cardForeground:    colors.slate[50],
  primary:           colors.purple[600],
  primaryForeground: colors.white,
  accent:            colors.amber[500],
  accentForeground:  colors.slate[950],
  muted:             colors.slate[800],
  mutedForeground:   colors.slate[400],
  border:            colors.slate[700],
  destructive:       colors.red[500],
  success:           colors.green[500],
} as const

// ─── Typography ───────────────────────────────────────────────────────────────

export const typography = {
  fontFamily: {
    sans: 'Poppins, ui-sans-serif, system-ui, -apple-system, sans-serif',
    mono: 'JetBrains Mono, Courier New, monospace',
  },
  fontSize: {
    xs:   '0.75rem',
    sm:   '0.875rem',
    base: '1rem',
    lg:   '1.125rem',
    xl:   '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
  },
  fontWeight: {
    normal:   400,
    medium:   500,
    semibold: 600,
    bold:     700,
  },
  lineHeight: {
    none:    1,
    tight:   1.25,
    snug:    1.375,
    normal:  1.5,
    relaxed: 1.625,
  },
} as const

// ─── Spacing ──────────────────────────────────────────────────────────────────

export const spacing = {
  0:  '0px',
  1:  '0.25rem',
  2:  '0.5rem',
  3:  '0.75rem',
  4:  '1rem',
  5:  '1.25rem',
  6:  '1.5rem',
  8:  '2rem',
  10: '2.5rem',
  12: '3rem',
  16: '4rem',
  20: '5rem',
  24: '6rem',
} as const

// ─── Border Radius ────────────────────────────────────────────────────────────

export const borderRadius = {
  none: '0px',
  sm:   '0.25rem',
  md:   '0.5rem',
  lg:   '0.75rem',
  xl:   '1rem',
  '2xl': '1.5rem',
  full: '9999px',
} as const

// ─── Shadows ──────────────────────────────────────────────────────────────────

export const shadows = {
  sm:          '0 1px 2px 0 oklch(0 0 0 / 0.05)',
  md:          '0 4px 6px -1px oklch(0 0 0 / 0.15), 0 2px 4px -2px oklch(0 0 0 / 0.1)',
  lg:          '0 10px 15px -3px oklch(0 0 0 / 0.2), 0 4px 6px -4px oklch(0 0 0 / 0.1)',
  xl:          '0 20px 25px -5px oklch(0 0 0 / 0.25), 0 8px 10px -6px oklch(0 0 0 / 0.1)',
  glowAccent:  '0 0 20px oklch(0.70 0.18 60 / 0.4)',
  glowPrimary: '0 0 20px oklch(0.35 0.15 265 / 0.5)',
} as const

// ─── Animation Durations ──────────────────────────────────────────────────────

export const duration = {
  instant: 0,
  fast:    100,
  normal:  200,
  slow:    300,
  slower:  500,
} as const

// ─── Component Tokens ─────────────────────────────────────────────────────────

export const components = {
  vinylDisc: {
    colorGroove:  colors.slate[900],
    colorLabel:   colors.amber[500],
    shimmerColor: colors.white,
    spinDurationMs: 3000,
  },
  glassCard: {
    background: 'oklch(0.15 0.02 270 / 0.7)',
    border:     'oklch(0.95 0.01 265 / 0.08)',
    blur:       '12px',
  },
} as const

// ─── Recharts / Chart Theme ───────────────────────────────────────────────────

export const chartTheme = {
  background:   semantic.card,
  text:         semantic.mutedForeground,
  gridLine:     semantic.border,
  colors: [
    colors.amber[500],
    colors.purple[400],
    colors.green[400],
    colors.amber[300],
    colors.purple[300],
  ],
} as const

export type ColorScale = typeof colors
export type SemanticTokens = typeof semantic
