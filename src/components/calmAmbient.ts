/** Soft, slow-moving ambient visuals tuned for a calm play surface. */

export const CALM_AMBIENT_BLOBS = [
  { x: 0.16, y: 0.2, hue: 178, sat: 44, size: 0.44 },
  { x: 0.82, y: 0.16, hue: 38, sat: 38, size: 0.38 },
  { x: 0.72, y: 0.72, hue: 200, sat: 36, size: 0.4 },
  { x: 0.22, y: 0.78, hue: 148, sat: 40, size: 0.36 },
  { x: 0.5, y: 0.48, hue: 215, sat: 32, size: 0.32 },
] as const;

export const CALM_SPARKLE_COUNT = 60;

const SPARKLE_HUES = [175, 38, 198, 145, 210, 42, 168, 132, 185, 55] as const;

export function calmSparklePoint(
  index: number,
  width: number,
  height: number,
): { x: number; y: number; hue: number; sat: number; radius: number } {
  const xSeed = ((index * 97) % 1000) / 1000;
  const ySeed = ((index * 57 + 13) % 1000) / 1000;
  return {
    x: xSeed * width,
    y: ySeed * height,
    hue: SPARKLE_HUES[index % SPARKLE_HUES.length],
    sat: 34 + (index % 5) * 8,
    radius: 1.4 + (index % 4) * 0.7,
  };
}
