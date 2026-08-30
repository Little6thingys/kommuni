/** Soft, slow-moving ambient visuals tuned for a calm play surface. */

export const CALM_AMBIENT_BLOBS = [
  { x: 0.16, y: 0.2, hue: 188, size: 0.44 },
  { x: 0.82, y: 0.16, hue: 212, size: 0.38 },
  { x: 0.72, y: 0.72, hue: 248, size: 0.4 },
  { x: 0.22, y: 0.78, hue: 168, size: 0.36 },
  { x: 0.5, y: 0.48, hue: 202, size: 0.32 },
] as const;

export const CALM_SPARKLE_COUNT = 80;

export function calmSparklePoint(
  index: number,
  width: number,
  height: number,
): { x: number; y: number; hue: number; radius: number } {
  const xSeed = ((index * 97) % 1000) / 1000;
  const ySeed = ((index * 57 + 13) % 1000) / 1000;
  return {
    x: xSeed * width,
    y: ySeed * height,
    hue: 178 + ((index * 23) % 88),
    radius: 1.6 + (index % 4) * 0.85,
  };
}
