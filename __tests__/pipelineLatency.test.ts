import { buildGazeFeatureVector, runCrossAttentionFusion } from '@/ml/crossAttention';
import { createHarmoniNetState, runHarmoniNet } from '@/ml/harmoniNet';
import { applyMusicTheoryMask, latentToAudioParams } from '@/ml/musicTheoryMask';
import { runTouchVAE } from '@/ml/touchVAE';
import { AUDIO_RENDER_ESTIMATE_MS, BENCHMARK_THRESHOLDS } from '@/metrics/constants';
import { computeConsonanceRate } from '@/metrics/consonance';
import {
  getDefaultPhase1Latent,
  getPhase1Latent,
  resetPhase1Latent,
  setPhase1Latent,
} from '@/session/phaseLatentStore';

import { averageRuntimeMs } from './support/measureRuntime';

function buildSyntheticWindow(): Float32Array {
  const window = new Float32Array(160);
  for (let i = 0; i < 32; i += 1) {
    window[i * 5] = 0.35;
    window[i * 5 + 1] = 0.22;
    window[i * 5 + 2] = 0.08;
    window[i * 5 + 3] = 0.05;
    window[i * 5 + 4] = 0.12;
  }
  return window;
}

describe('five-module synthetic pipeline', () => {
  afterEach(() => {
    resetPhase1Latent();
  });

  it('meets Section 6 latency, consonance, and output shape targets', () => {
    const window = buildSyntheticWindow();
    const rhythmTap = [0, 280, 560, 840];
    const gaze = buildGazeFeatureVector({
      gazeAngle: 6,
      isJointAttention: true,
      headPose: { yaw: 1, pitch: -2, roll: 0 },
    });

    const inferenceMs = averageRuntimeMs(() => {
      const latent = runTouchVAE(window);
      const { output } = runHarmoniNet(latent.z, rhythmTap, createHarmoniNetState());
      const masked = applyMusicTheoryMask(output.chordNotes);
      runCrossAttentionFusion(output.chordVector, gaze, true, {
        tension: output.tension,
        rhythmTap,
      });
      latentToAudioParams(latent.z, latent.stressLevel);
      void masked;
    });

    const latent = runTouchVAE(window);
    setPhase1Latent(latent.z);
    expect(latent.z.length).toBe(8);
    expect(getDefaultPhase1Latent().length).toBe(8);
    expect(Array.from(getPhase1Latent())).toEqual(Array.from(latent.z));

    const { output } = runHarmoniNet(latent.z, rhythmTap, createHarmoniNetState());
    const maskedNotes = applyMusicTheoryMask(output.chordNotes);
    const fusion = runCrossAttentionFusion(output.chordVector, gaze, true, {
      tension: output.tension,
      rhythmTap,
    });
    const audio = latentToAudioParams(latent.z, latent.stressLevel);

    expect(inferenceMs).toBeLessThan(BENCHMARK_THRESHOLDS.maxInferenceMs);
    expect(inferenceMs + AUDIO_RENDER_ESTIMATE_MS).toBeLessThan(
      BENCHMARK_THRESHOLDS.maxEndToEndMs,
    );
    expect(computeConsonanceRate([...maskedNotes, ...audio.notes])).toBeGreaterThan(
      BENCHMARK_THRESHOLDS.minConsonanceRate,
    );

    expect(gaze.length).toBe(4);
    expect(output.chordNotes.length).toBeGreaterThan(0);
    expect(output.chordVector.length).toBe(12);
    expect(fusion.audioParams.notes.length).toBeGreaterThan(0);
    expect(fusion.audioParams.overtones.length).toBeGreaterThan(0);
    expect(fusion.audioParams.filterFreq).toBeGreaterThan(0);
    expect(audio.notes.length).toBeGreaterThan(0);
  });
});
