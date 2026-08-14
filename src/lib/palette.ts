/** SPEC.md §8 — პალიტრა. ერთი წყარო CSS-ისთვისაც და three.js-ისთვისაც. */
export const PALETTE = {
  night: '#08120E',
  turf: '#12281F',
  chalk: '#E8EDE6',
  sodium: '#F2B23E',
  card: '#D8443C',
  floodlight: '#6FA8C7',
} as const

export type PaletteKey = keyof typeof PALETTE
