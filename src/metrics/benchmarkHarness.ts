import { buildGazeFeatureVector, runCrossAttentionFusion } from '@/ml/crossAttention';
import { createHarmoniNetState, runHarmoniNet } from '@/ml/harmoniNet';
import { applyMusicTheoryMask } from '@/ml/musicTheoryMask';
import { runTouchVAE } from '@/ml/touchVAE';
import { GazeSnapshot } from '@/types';
import {
  AUDIO_RENDER_ESTIMATE_MS,
  BENCHMARK_PROFILE_COUNT,
  BENCHMARK_THRESHOLDS,
  FRAME_BUDGET_MS,
} from '@/metrics/constants';
import { computeConsonanceRate } from '@/metrics/consonance';
import { metricsStore } from '@/metrics/MetricsStore';

export type BenchmarkCriterionId =
  | 'inference'
  | 'end_to_end'
  | 'cpu_proxy'
  | 'consonance';

export type BenchmarkCriterion = {
  id: BenchmarkCriterionId;
  label: string;
  value: number;
  threshold: number;
  unit: string;
  passed: boolean;
  higherIsBetter: boolean;
};

export type BenchmarkReport = {
  profileCount: number;
  wallClockMs: number;
  criteria: BenchmarkCriterion[];
  passed: boolean;
  avgInferenceMs: number;
  avgEndToEndMs: number;
  cpuProxyPercent: number;
  consonanceRate: number;
};

export type BenchmarkProgress = {
  completed: number;
  total: number;
};

type SeededRandom = () => number;

function createSeededRandom(seed: number): SeededRandom {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function generateTouchWindow(rng: SeededRandom): Float32Array {
  const window = new Float32Array(160);
  for (let i = 0; i < 160; i += 5) {
    window[i] = (rng() - 0.5) * 2;
    window[i + 1] = (rng() - 0.5) * 2;
    window[i + 2] = (rng() - 0.5) * 0.5;
    window[i + 3] = (rng() - 0.5) * 0.5;
    window[i + 4] = rng() * 0.3;
  }
  return window;
}

function generateRhythmTap(rng: SeededRandom): number[] {
  const base = rng() * 500;
  return [base, base + 120 + rng() * 40, base + 260 + rng() * 40, base + 400 + rng() * 40];
}

function nowMs(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

function buildCriteria(
  avgInferenceMs: number,
  avgEndToEndMs: number,
  cpuProxyPercent: number,
  consonanceRate: number,
): BenchmarkCriterion[] {
  return [
    {
      id: 'inference',
      label: 'Inference',
      value: avgInferenceMs,
      threshold: BENCHMARK_THRESHOLDS.maxInferenceMs,
      unit: 'ms',
      passed: avgInferenceMs < BENCHMARK_THRESHOLDS.maxInferenceMs,
      higherIsBetter: false,
    },
    {
      id: 'end_to_end',
      label: 'End-to-end',
      value: avgEndToEndMs,
      threshold: BENCHMARK_THRESHOLDS.maxEndToEndMs,
      unit: 'ms',
      passed: avgEndToEndMs < BENCHMARK_THRESHOLDS.maxEndToEndMs,
      higherIsBetter: false,
    },
    {
      id: 'cpu_proxy',
      label: 'CPU proxy',
      value: cpuProxyPercent,
      threshold: BENCHMARK_THRESHOLDS.maxCpuProxyPercent,
      unit: '%',
      passed: cpuProxyPercent < BENCHMARK_THRESHOLDS.maxCpuProxyPercent,
      higherIsBetter: false,
    },
    {
      id: 'consonance',
      label: 'Consonance',
      value: consonanceRate * 100,
      threshold: BENCHMARK_THRESHOLDS.minConsonanceRate * 100,
      unit: '%',
      passed: consonanceRate >= BENCHMARK_THRESHOLDS.minConsonanceRate,
      higherIsBetter: true,
    },
  ];
}

export function runBenchmarkHarness(
  profileCount: number = BENCHMARK_PROFILE_COUNT,
  onProgress?: (progress: BenchmarkProgress) => void,
): BenchmarkReport {
  const wallStart = nowMs();

  let totalInferenceMs = 0;
  let totalEndToEndMs = 0;
  const outputNotes: number[] = [];
  let harmoniState = createHarmoniNetState();

  for (let index = 0; index < profileCount; index += 1) {
    const rng = createSeededRandom(index + 1);
    const touchWindow = generateTouchWindow(rng);
    const rhythmTap = generateRhythmTap(rng);
    const gazeAngle = 10 + rng() * 30;
    const isJointAttention = rng() > 0.7;
    const headPose = {
      yaw: (rng() - 0.5) * 40,
      pitch: (rng() - 0.5) * 30,
      roll: (rng() - 0.5) * 20,
    };

    let inferenceMs = 0;

    const touchStart = nowMs();
    const latent = runTouchVAE(touchWindow);
    inferenceMs += nowMs() - touchStart;

    const harmoniStart = nowMs();
    const harmoniResult = runHarmoniNet(latent.z, rhythmTap, harmoniState);
    harmoniState = harmoniResult.state;
    inferenceMs += nowMs() - harmoniStart;

    const maskedNotes = applyMusicTheoryMask(harmoniResult.output.chordNotes);
    outputNotes.push(...maskedNotes);

    const gazeSnapshot: GazeSnapshot = {
      gazeAngle,
      isJointAttention,
      headPose,
    };
    const gazeVector = buildGazeFeatureVector(gazeSnapshot);

    const fusionStart = nowMs();
    const fusion = runCrossAttentionFusion(
      harmoniResult.output.chordVector,
      gazeVector,
      isJointAttention,
      { tension: harmoniResult.output.tension, rhythmTap },
    );
    inferenceMs += nowMs() - fusionStart;

    const fusedNotes = applyMusicTheoryMask(fusion.audioParams.notes);
    outputNotes.push(...fusedNotes);

    const endToEndMs = inferenceMs + AUDIO_RENDER_ESTIMATE_MS;

    totalInferenceMs += inferenceMs;
    totalEndToEndMs += endToEndMs;

    if (onProgress && (index === profileCount - 1 || index % 50 === 0)) {
      onProgress({ completed: index + 1, total: profileCount });
    }
  }

  const wallClockMs = nowMs() - wallStart;
  const avgInferenceMs = totalInferenceMs / profileCount;
  const avgEndToEndMs = totalEndToEndMs / profileCount;
  const cpuProxyPercent = (avgInferenceMs / FRAME_BUDGET_MS) * 100;
  const consonanceRate = computeConsonanceRate(outputNotes);

  const criteria = buildCriteria(avgInferenceMs, avgEndToEndMs, cpuProxyPercent, consonanceRate);
  const passed = criteria.every((criterion) => criterion.passed);

  const report: BenchmarkReport = {
    profileCount,
    wallClockMs,
    criteria,
    passed,
    avgInferenceMs,
    avgEndToEndMs,
    cpuProxyPercent,
    consonanceRate,
  };

  metricsStore.record({
    kind: 'benchmark',
    payload: {
      passed,
      profileCount,
      avgInferenceMs: Number(avgInferenceMs.toFixed(3)),
      avgEndToEndMs: Number(avgEndToEndMs.toFixed(3)),
      cpuProxyPercent: Number(cpuProxyPercent.toFixed(2)),
      consonanceRate: Number((consonanceRate * 100).toFixed(2)),
      wallClockMs: Number(wallClockMs.toFixed(1)),
    },
  });

  return report;
}
