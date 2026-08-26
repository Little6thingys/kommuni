import {
  applyMusicTheoryMask,
  consonanceEnvelope,
  latentToAudioParams,
} from '@/ml/musicTheoryMask';
import { BENCHMARK_THRESHOLDS } from '@/metrics/constants';
import { computeConsonanceRate } from '@/metrics/consonance';

describe('musicTheoryMask', () => {
  it('maps dissonant pitch classes toward pentatonic set', () => {
    const masked = applyMusicTheoryMask([61, 63, 66]);
    expect(masked).toEqual([60, 62, 67]);
  });

  it('builds audio params from latent vectors', () => {
    const z = new Float32Array([0.2, -0.1, 0.4, 0.3, -0.2, 0.1, 0.5, 0]);
    const params = latentToAudioParams(z, 0.35);

    expect(params.notes.length).toBeGreaterThan(0);
    expect(params.overtones.length).toBeGreaterThan(0);
    expect(params.filterFreq).toBeGreaterThan(400);
    expect(params.latentEnergy).toBeGreaterThan(0);
  });

  it('scores consonance above the 90% Section 6 threshold for masked chords', () => {
    const notes = applyMusicTheoryMask([60, 64, 67, 61, 66]);
    expect(computeConsonanceRate(notes)).toBeGreaterThan(BENCHMARK_THRESHOLDS.minConsonanceRate);
    expect(consonanceEnvelope(notes)).toBeGreaterThan(0.8);
  });
});
