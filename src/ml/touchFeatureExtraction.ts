export type TouchPoint = {
  x: number;
  y: number;
  t: number;
};

export type TouchFeatureTuple = [number, number, number, number, number];

const MIN_DT_MS = 1;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Derives [vx, vy, ax, ay, curvature] from the latest touch history. */
export function extractTouchFeatures(history: readonly TouchPoint[]): TouchFeatureTuple {
  if (history.length === 0) {
    return [0, 0, 0, 0, 0];
  }

  if (history.length === 1) {
    return [0, 0, 0, 0, 0];
  }

  const prev = history[history.length - 2];
  const curr = history[history.length - 1];
  const dt = Math.max(MIN_DT_MS, curr.t - prev.t);
  const vx = (curr.x - prev.x) / dt;
  const vy = (curr.y - prev.y) / dt;

  let ax = 0;
  let ay = 0;
  if (history.length >= 3) {
    const older = history[history.length - 3];
    const olderDt = Math.max(MIN_DT_MS, prev.t - older.t);
    const prevVx = (prev.x - older.x) / olderDt;
    const prevVy = (prev.y - older.y) / olderDt;
    ax = (vx - prevVx) / dt;
    ay = (vy - prevVy) / dt;
  }

  let curvature = 0;
  if (history.length >= 3) {
    const p0 = history[history.length - 3];
    const p1 = prev;
    const p2 = curr;
    const dx1 = p1.x - p0.x;
    const dy1 = p1.y - p0.y;
    const dx2 = p2.x - p1.x;
    const dy2 = p2.y - p1.y;
    const cross = dx1 * dy2 - dy1 * dx2;
    const len1 = Math.hypot(dx1, dy1);
    const len2 = Math.hypot(dx2, dy2);
    const denom = len1 * len2;
    curvature = denom > 1e-6 ? clamp(Math.abs(cross) / denom, 0, 1) : 0;
  }

  return [
    clamp(vx, -4, 4),
    clamp(vy, -4, 4),
    clamp(ax, -8, 8),
    clamp(ay, -8, 8),
    curvature,
  ];
}
