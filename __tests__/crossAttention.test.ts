import { buildGazeFeatureVector, runCrossAttentionFusion } from '@/ml/crossAttention';
import { AUDIO_RENDER_ESTIMATE_MS, BENCHMARK_THRESHOLDS } from '@/metrics/constants';

import { averageRuntimeMs } from './support/measureRuntime';

describe('crossAttention', () => {
  it('returns audio params from chord and gaze vectors', () => {
    const gaze = buildGazeFeatureVector({
      gazeAngle: 4,
      isJointAttention: true,
      headPose: { yaw: 2, pitch: -1, roll: 0 },
    });
    expect(gaze.length).toBe(4);

    const result = runCrossAttentionFusion(
      new Float32Array([1, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0]),
      gaze,
      true,
      { tension: 0.4, rhythmTap: [0, 300, 600] },
    );

    expect(result.audioParams.notes.length).toBeGreaterThan(0);
    expect(result.audioParams.filterFreq).toBeGreaterThan(500);
    expect(result.audioParams.overtones.length).toBeGreaterThanOrEqual(3);
    expect(result.audioParams.latentEnergy).toBeGreaterThan(0);
  });

  it('runs fusion under the 15ms inference budget', () => {
    const gaze = buildGazeFeatureVector({
      gazeAngle: 4,
      isJointAttention: false,
      headPose: { yaw: 0, pitch: 0, roll: 0 },
    });
    const chord = new Float32Array(12);
    chord[0] = 1;
    chord[7] = 1;
    const inferenceMs = averageRuntimeMs(() => {
      runCrossAttentionFusion(chord, gaze, false);
    });
    expect(inferenceMs).toBeLessThan(BENCHMARK_THRESHOLDS.maxInferenceMs);
    expect(inferenceMs + AUDIO_RENDER_ESTIMATE_MS).toBeLessThan(
      BENCHMARK_THRESHOLDS.maxEndToEndMs,
    );
  });

  it('boosts overtone partials during joint attention', () => {
    const gaze = buildGazeFeatureVector({
      gazeAngle: 2,
      isJointAttention: true,
      headPose: { yaw: 0, pitch: 0, roll: 0 },
    });
    const chord = new Float32Array(12);
    chord[0] = 1;
    chord[4] = 0.8;
    chord[7] = 0.9;

    const joint = runCrossAttentionFusion(chord, gaze, true);
    const solo = runCrossAttentionFusion(chord, gaze, false);

    expect(joint.audioParams.overtones.length).toBeGreaterThan(solo.audioParams.overtones.length);
  });
});
