import { runTouchVAE } from '@/ml/touchVAE';
import { BENCHMARK_THRESHOLDS } from '@/metrics/constants';

import { averageRuntimeMs } from './support/measureRuntime';

function buildWindow(): Float32Array {
  const window = new Float32Array(32 * 5);
  for (let i = 0; i < 32; i += 1) {
    window[i * 5] = 0.8;
    window[i * 5 + 1] = 0.4;
    window[i * 5 + 4] = 0.2;
  }
  return window;
}

describe('touchVAE', () => {
  it('returns 8-dim latent vector with bounded stress', () => {
    const result = runTouchVAE(buildWindow());
    expect(result.z.length).toBe(8);
    expect(result.stressLevel).toBeGreaterThan(0);
    expect(result.stressLevel).toBeLessThanOrEqual(1);
  });

  it('runs inference under the 15ms Section 6 budget', () => {
    const window = buildWindow();
    const inferenceMs = averageRuntimeMs(() => {
      runTouchVAE(window);
    });
    expect(inferenceMs).toBeLessThan(BENCHMARK_THRESHOLDS.maxInferenceMs);
  });
});
