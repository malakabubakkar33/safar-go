/**
 * SafarGo - Official Design Tokens & Visual Identity System
 * Palette: Emerald Green (#16A34A / #15803D) + Crisp White (#FFFFFF)
 * Style: Clean, Premium, Modern, Professional, Smooth, Minimal
 */

export const colors = {
  // Brand Emerald Green Palette
  brand: {
    50: '#F0FDF4',
    100: '#DCFCE7',
    200: '#BBF7D0',
    300: '#86EFAC',
    400: '#4ADE80',
    500: '#22C55E',
    600: '#16A34A', // Core Brand Primary
    700: '#15803D', // Core Brand Hover / Pressed
    800: '#166534',
    900: '#14532D',
    950: '#052E16',
  },

  // Base Neutrals
  neutral: {
    white: '#FFFFFF',
    surface: '#F8FAFC',
    card: '#FFFFFF',
    border: '#E2E8F0',
    borderLight: '#F1F5F9',
    muted: '#94A3B8',
    textSecondary: '#64748B',
    textPrimary: '#0F172A',
    black: '#000000',
  },

  // Semantic Status Colors
  status: {
    success: '#16A34A',
    successLight: '#DCFCE7',
    error: '#DC2626',
    errorLight: '#FEE2E2',
    warning: '#D97706',
    warningLight: '#FEF3C7',
    info: '#2563EB',
    infoLight: '#DBEAFE',
  },

  // Gradients
  gradients: {
    primaryGreen: 'linear-gradient(135deg, #16A34A 0%, #15803D 100%)',
    heroShimmer: 'linear-gradient(180deg, rgba(22,163,74,0.08) 0%, rgba(255,255,255,0) 100%)',
    cardGlow: 'radial-gradient(circle at 50% 0%, rgba(22,163,74,0.12) 0%, transparent 70%)',
  },
};

export const typography = {
  fontFamily: {
    sans: 'Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },
  lineHeight: {
    tight: 1.2,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
  },
};

export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
};

export const radii = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  '2xl': 24,
  full: 9999,
};

export const shadows = {
  card: '0 4px 20px -2px rgba(15, 23, 42, 0.06), 0 2px 6px -1px rgba(15, 23, 42, 0.04)',
  buttonPrimary: '0 8px 20px -4px rgba(22, 163, 74, 0.35)',
  buttonSecondary: '0 2px 8px rgba(0, 0, 0, 0.04)',
  elevated: '0 20px 40px -15px rgba(0, 0, 0, 0.12)',
};

export const animation = {
  duration: {
    instant: 150,
    normal: 300,
    smooth: 450,
    splashFade: 600,
  },
  easing: {
    standard: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
    outBack: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
};
