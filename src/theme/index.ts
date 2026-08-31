export const colors = {
  mist: '#E8F1F0',
  foam: '#F4FAF9',
  lagoon: '#B7D4D0',
  tide: '#6FA8A2',
  deepTide: '#3D6F6A',
  ink: '#1F3331',
  inkSoft: '#4A635F',
  ripple: '#8FC4BD',
  rippleSoft: '#C5E2DD',
  accent: '#5B8F88',
  warnSoft: '#C4A882',
} as const;

export const fonts = {
  display: 'Fraunces_500Medium',
  displayRegular: 'Fraunces_400Regular',
  body: 'SourceSans3_400Regular',
  bodyMedium: 'SourceSans3_500Medium',
} as const;

export const spacing = {
  screenPadding: 28,
  contentMaxWidth: 520,
} as const;

export const radii = {
  button: 14,
  card: 14,
  pill: 999,
} as const;

export const typography = {
  displayTitle: {
    fontFamily: fonts.display,
    fontSize: 42,
    letterSpacing: -0.5,
    color: colors.ink,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 26,
    color: colors.ink,
  },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
    color: colors.inkSoft,
  },
  ghost: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.inkSoft,
  },
} as const;

/** Skia / canvas palettes for calm play surfaces. */
export const visual = {
  canvasGradient: [colors.mist, colors.foam, colors.rippleSoft, colors.mist] as const,
  /** Phase 1 — wider hue spread: cool teal, warm sand, soft blue, sage. */
  phase1Gradient: [
    colors.mist,
    '#F5F0E6',
    colors.foam,
    '#D8EBE8',
    colors.rippleSoft,
  ] as const,
  phase2Gradient: [colors.foam, colors.mist, colors.lagoon, colors.foam] as const,
  phase1CalmHue: 178,
  phase1StressedHue: 36,
  calmHue: 176,
  stressedHueShift: 48,
  /** Distinct hues per latent bar — teal, sand, blue, sage, periwinkle, amber, tide, green. */
  phase1LatentBarHues: [175, 38, 198, 148, 215, 42, 168, 132] as const,
  latentBarHues: [168, 172, 176, 180, 165, 170, 185, 174] as const,
  partnerHue: 182,
  selfHue: 166,
} as const;
