/** Pass/fail thresholds — plan §6 Benchmark Mode (Tier 1 synthetic harness). */
export const BENCHMARK_THRESHOLDS = {
  maxInferenceMs: 15,
  maxEndToEndMs: 35,
  maxCpuProxyPercent: 15,
  minConsonanceRate: 0.9,
} as const;

export const BENCHMARK_PROFILE_COUNT = 1000;

/** Estimated WebView audio render budget added to inference for end-to-end latency. */
export const AUDIO_RENDER_ESTIMATE_MS = 8;

/** 60 fps frame budget used for CPU proxy percentage. */
export const FRAME_BUDGET_MS = 1000 / 60;

export const METRICS_EXPORT_SECRET = 'kommuni-local-export-v1';
