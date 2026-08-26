import { createHarmoniNetState, runHarmoniNet } from '@/ml/harmoniNet';
import { applyMusicTheoryMask } from '@/ml/musicTheoryMask';
import { AUDIO_RENDER_ESTIMATE_MS, BENCHMARK_THRESHOLDS } from '@/metrics/constants';
import { computeConsonanceRate } from '@/metrics/consonance';

import { averageRuntimeMs } from './support/measureRuntime';

describe('harmoniNet', () => {
  it('returns chord notes and a 12-dim chord vector', () => {
    const { output } = runHarmoniNet(new Float32Array(8), [0, 320, 640], createHarmoniNetState());
    expect(output.chordNotes.length).toBeGreaterThan(0);
    expect(output.chordVector.length).toBe(12);
    expect(output.tension).toBeGreaterThanOrEqual(0);
    expect(output.tension).toBeLessThanOrEqual(1);
  });

  it('runs inference under the 15ms budget with estimated end-to-end under 35ms', () => {
    const z = new Float32Array([0.1, 0.2, -0.1, 0.05, 0.08, 0.03, 0.4, 0.1]);
    const inferenceMs = averageRuntimeMs(() => {
      runHarmoniNet(z, [0, 300, 600], createHarmoniNetState());
    });
    expect(inferenceMs).toBeLessThan(BENCHMARK_THRESHOLDS.maxInferenceMs);
    expect(inferenceMs + AUDIO_RENDER_ESTIMATE_MS).toBeLessThan(
      BENCHMARK_THRESHOLDS.maxEndToEndMs,
    );
  });

  it('keeps consonance above 95% after music theory mask', () => {
    const PENTATONIC = new Set([0, 2, 4, 7, 9]);
    let consonant = 0;
    const trials = 200;
    const maskedNotes: number[] = [];

    for (let i = 0; i < trials; i += 1) {
      const z = new Float32Array(8);
      for (let j = 0; j < z.length; j += 1) {
        z[j] = Math.sin(i + j);
      }
      const { output } = runHarmoniNet(z, [i * 10, i * 10 + 300], createHarmoniNetState());
      const masked = applyMusicTheoryMask(output.chordNotes);
      maskedNotes.push(...masked);
      const allConsonant = masked.every((note) => PENTATONIC.has(((note % 12) + 12) % 12));
      if (allConsonant) {
        consonant += 1;
      }
    }

    expect(consonant / trials).toBeGreaterThan(0.95);
    expect(computeConsonanceRate(maskedNotes)).toBeGreaterThan(
      BENCHMARK_THRESHOLDS.minConsonanceRate,
    );
  });
});
